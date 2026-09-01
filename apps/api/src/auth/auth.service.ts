import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import { Role, User } from "@prisma/client";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import { createHash, randomBytes } from "node:crypto";
import { AppEnv } from "../config/env";
import { LEGAL_VERSION } from "../legal/legal-version";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
} from "./dto/password-reset.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";

type SafeUser = Omit<User, "passwordHash" | "twoFactorSecret">;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.role === Role.CLIENTE && !existing.emailVerifiedAt) {
        const token = await this.createEmailToken(existing.id);
        await this.mailService.sendVerificationEmail(
          existing.email,
          token,
          existing.name,
        );

        return {
          user: this.safeUser(existing),
          ...(this.isProduction() ? {} : { verificationToken: token }),
        };
      }

      throw new ConflictException("Email is already registered.");
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name: dto.name.trim(),
        phone: dto.phone,
        acceptedLegalAt: new Date(),
        legalVersion: LEGAL_VERSION,
      },
    });

    const token = await this.createEmailToken(user.id);
    await this.mailService.sendVerificationEmail(user.email, token, user.name);

    return {
      user: this.safeUser(user),
      ...(this.isProduction() ? {} : { verificationToken: token }),
    };
  }

  async login(dto: LoginDto, requiredRole?: Role | Role[]) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    if (!user.active) {
      throw new UnauthorizedException("Account is disabled.");
    }

    const requiredRoles = Array.isArray(requiredRole)
      ? requiredRole
      : requiredRole
        ? [requiredRole]
        : [];

    if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
      throw new UnauthorizedException("Invalid credentials for this area.");
    }

    if (user.role === Role.CLIENTE && !user.emailVerifiedAt) {
      throw new UnauthorizedException("Email address is not verified.");
    }

    if (user.twoFactorEnabled) {
      if (!dto.totpCode || !user.twoFactorSecret) {
        throw new UnauthorizedException("Two factor code is required.");
      }

      const validCode = authenticator.check(dto.totpCode, user.twoFactorSecret);
      if (!validCode) {
        throw new UnauthorizedException("Invalid two factor code.");
      }
    }

    return {
      accessToken: await this.signUser(user),
      user: this.safeUser(user),
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.active) {
      throw new UnauthorizedException("Account is disabled.");
    }

    return this.safeUser(user);
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (!user || !user.active) {
      return { ok: true };
    }

    const token = this.rawToken();
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(token),
        expiresAt: this.minutesFromNow(30),
      },
    });

    await this.mailService.sendPasswordResetEmail(user.email, token);
    return {
      ok: true,
      ...(this.isProduction() ? {} : { resetToken: token }),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt < new Date() ||
      !resetToken.user.active
    ) {
      throw new BadRequestException("Invalid or expired reset token.");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: await argon2.hash(dto.password) },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const tokenHash = this.hashToken(dto.token);
    const token = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
    });

    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw new BadRequestException("Invalid or expired verification token.");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  async createTwoFactorSecret(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: secret,
        twoFactorEnabled: false,
      },
    });

    return {
      secret,
      otpauthUrl: authenticator.keyuri(
        user.email,
        "Mordida Tasty Admin",
        secret,
      ),
    };
  }

  async confirmTwoFactor(userId: string, code: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (
      !user.twoFactorSecret ||
      !authenticator.check(code, user.twoFactorSecret)
    ) {
      throw new BadRequestException("Invalid two factor code.");
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });

    return { ok: true };
  }

  private async createEmailToken(userId: string) {
    const token = this.rawToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(token),
        expiresAt: this.minutesFromNow(24 * 60),
      },
    });
    return token;
  }

  private async signUser(user: User) {
    const expiresIn =
      user.role === Role.CLIENTE
        ? this.configService.get("JWT_EXPIRES_IN", { infer: true })
        : this.configService.get("ADMIN_JWT_EXPIRES_IN", { infer: true });

    const signOptions: JwtSignOptions = {
      expiresIn: expiresIn as JwtSignOptions["expiresIn"],
    };

    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
      },
      signOptions,
    );
  }

  private rawToken() {
    return randomBytes(32).toString("base64url");
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private minutesFromNow(minutes: number) {
    return new Date(Date.now() + minutes * 60_000);
  }

  private safeUser(user: User): SafeUser {
    const {
      passwordHash: _passwordHash,
      twoFactorSecret: _twoFactorSecret,
      ...safe
    } = user;
    return safe;
  }

  private isProduction() {
    return this.configService.get("NODE_ENV", { infer: true }) === "production";
  }
}
