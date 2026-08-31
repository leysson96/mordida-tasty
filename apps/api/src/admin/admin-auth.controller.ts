import { Body, Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { Response } from "express";
import { AuthService } from "../auth/auth.service";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE_MS,
  clearSessionCookie,
  SessionCookieConfig,
  setSessionCookie,
} from "../auth/auth-cookies";
import { LoginDto } from "../auth/dto/login.dto";
import { ConfirmTwoFactorDto } from "../auth/dto/two-factor.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AppEnv } from "../config/env";

@Controller("admin/auth")
export class AdminAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.login(dto, [
      Role.ADMIN,
      Role.KITCHEN,
    ]);
    setSessionCookie(
      response,
      ADMIN_SESSION_COOKIE,
      session.accessToken,
      this.cookieConfig(),
      ADMIN_SESSION_MAX_AGE_MS,
    );
    return { user: session.user };
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    clearSessionCookie(response, ADMIN_SESSION_COOKIE, this.cookieConfig());
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.KITCHEN)
  @Get("me")
  me(@CurrentUser() user: { id: string }) {
    return this.authService.me(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post("2fa/setup")
  setupTwoFactor(@CurrentUser() user: { id: string }) {
    return this.authService.createTwoFactorSecret(user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post("2fa/confirm")
  confirmTwoFactor(
    @CurrentUser() user: { id: string },
    @Body() dto: ConfirmTwoFactorDto,
  ) {
    return this.authService.confirmTwoFactor(user.id, dto.code);
  }

  private isProduction() {
    return this.configService.get("NODE_ENV", { infer: true }) === "production";
  }

  private cookieConfig(): SessionCookieConfig {
    return {
      production: this.isProduction(),
      domain: this.configService.get("SESSION_COOKIE_DOMAIN", { infer: true }),
      sameSite: this.configService.get("SESSION_COOKIE_SAME_SITE", {
        infer: true,
      }),
    };
  }
}
