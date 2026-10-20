import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { AuthSessionScope, Role, User } from "@prisma/client";
import * as argon2 from "argon2";
import { authenticator } from "otplib";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
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
import {
  renewedSessionExpiration,
  sessionWindowForRole,
} from "./session-policy";
import { TotpCryptoService } from "./totp-crypto.service";

type SafeUser = Omit<User, "passwordHash" | "twoFactorSecret">;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService<AppEnv, true>,
    private readonly totpCrypto: TotpCryptoService,
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

    if (user.role !== Role.CLIENTE && !user.twoFactorEnabled) {
      return {
        enrollmentToken: await this.signEnrollmentToken(user),
        requiresTwoFactorSetup: true as const,
        user: this.safeUser(user),
      };
    }

    if (user.twoFactorEnabled) {
      if (!dto.totpCode || !user.twoFactorSecret) {
        throw new UnauthorizedException("Two factor code is required.");
      }

      const storedSecret = this.totpCrypto.decrypt(user.twoFactorSecret);
      const validCode = authenticator.check(dto.totpCode, storedSecret.secret);
      if (!validCode) {
        throw new UnauthorizedException("Invalid two factor code.");
      }

      if (storedSecret.legacy) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { twoFactorSecret: this.totpCrypto.encrypt(storedSecret.secret) },
        });
      }
    }

    return this.createSession(user);
  }

  async refreshSession(refreshToken: string | undefined, scope: AuthSessionScope) {
    const parsed = this.parseRefreshToken(refreshToken);
    const session = await this.prisma.authSession.findUnique({
      where: { id: parsed.sessionId },
      include: { user: true },
    });
    const now = new Date();

    if (!session || !this.tokenHashesMatch(session.tokenHash, parsed.secret)) {
      if (session && !session.revokedAt) {
        await this.revokeSession(session.id);
      }
      throw new UnauthorizedException("Invalid or reused refresh token.");
    }

    if (
      session.scope !== scope ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.absoluteExpiresAt <= now ||
      !session.user.active ||
      this.scopeForRole(session.user.role) !== scope
    ) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException("Refresh session is expired or revoked.");
    }

    const nextSecret = this.rawToken();
    const nextTokenHash = this.hashToken(nextSecret);
    const nextExpiresAt = renewedSessionExpiration({
      scope: session.scope,
      now,
      absoluteExpiresAt: session.absoluteExpiresAt,
    });
    const rotated = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        tokenHash: session.tokenHash,
        revokedAt: null,
      },
      data: {
        tokenHash: nextTokenHash,
        lastSeenAt: now,
        expiresAt: nextExpiresAt,
      },
    });

    if (rotated.count !== 1) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException("Refresh token was already used.");
    }

    return {
      accessToken: await this.signAccessToken(session.user, session.id),
      refreshToken: this.formatRefreshToken(session.id, nextSecret),
      user: this.safeUser(session.user),
    };
  }

  async revokeRefreshSession(
    refreshToken: string | undefined,
    scope: AuthSessionScope,
  ) {
    if (!refreshToken) {
      return;
    }

    let parsed: { sessionId: string; secret: string };
    try {
      parsed = this.parseRefreshToken(refreshToken);
    } catch {
      return;
    }

    const session = await this.prisma.authSession.findUnique({
      where: { id: parsed.sessionId },
    });
    if (
      session?.scope === scope &&
      this.tokenHashesMatch(session.tokenHash, parsed.secret)
    ) {
      await this.revokeSession(session.id);
    }
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
      this.prisma.authSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { ok: true };
  }

  async revokeSession(sessionId?: string) {
    if (!sessionId) {
      return;
    }

    await this.prisma.authSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
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
    if (
      !user.active ||
      (user.role !== Role.ADMIN && user.role !== Role.KITCHEN)
    ) {
      throw new UnauthorizedException("Two factor setup is restricted to staff.");
    }
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorSecret: this.totpCrypto.encrypt(secret),
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
      !user.active ||
      (user.role !== Role.ADMIN && user.role !== Role.KITCHEN)
    ) {
      throw new UnauthorizedException("Two factor setup is restricted to staff.");
    }

    if (!user.twoFactorSecret) {
      throw new BadRequestException("Invalid two factor code.");
    }

    const storedSecret = this.totpCrypto.decrypt(user.twoFactorSecret);
    if (!authenticator.check(code, storedSecret.secret)) {
      throw new BadRequestException("Invalid two factor code.");
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        ...(storedSecret.legacy
          ? { twoFactorSecret: this.totpCrypto.encrypt(storedSecret.secret) }
          : {}),
      },
    });

    return this.createSession(updatedUser);
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

  private async createSession(user: User) {
    const now = new Date();
    const sessionId = randomUUID();
    const refreshSecret = this.rawToken();
    const window = sessionWindowForRole(user.role, now);

    await this.prisma.authSession.create({
      data: {
        id: sessionId,
        tokenHash: this.hashToken(refreshSecret),
        userId: user.id,
        scope: window.scope,
        lastSeenAt: now,
        expiresAt: window.expiresAt,
        absoluteExpiresAt: window.absoluteExpiresAt,
      },
    });

    return {
      accessToken: await this.signAccessToken(user, sessionId),
      refreshToken: this.formatRefreshToken(sessionId, refreshSecret),
      user: this.safeUser(user),
    };
  }

  private signAccessToken(user: User, sessionId: string) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        sid: sessionId,
      },
      { expiresIn: "15m" },
    );
  }

  private signEnrollmentToken(user: User) {
    return this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        purpose: "2fa-enrollment",
      },
      { expiresIn: "10m" },
    );
  }

  private parseRefreshToken(token: string | undefined) {
    if (!token) {
      throw new UnauthorizedException("Refresh token is required.");
    }

    const separator = token.indexOf(".");
    const sessionId = token.slice(0, separator);
    const secret = token.slice(separator + 1);
    if (
      separator <= 0 ||
      !/^[0-9a-f-]{36}$/i.test(sessionId) ||
      !/^[A-Za-z0-9_-]{32,}$/.test(secret)
    ) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    return { sessionId, secret };
  }

  private formatRefreshToken(sessionId: string, secret: string) {
    return `${sessionId}.${secret}`;
  }

  private tokenHashesMatch(expectedHash: string, secret: string) {
    const actual = Buffer.from(this.hashToken(secret), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  private scopeForRole(role: Role) {
    return role === Role.CLIENTE
      ? AuthSessionScope.CUSTOMER
      : AuthSessionScope.STAFF;
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
