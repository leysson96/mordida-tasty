import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthSessionScope, Role } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { AuthService } from "../auth/auth.service";
import {
  ADMIN_REFRESH_COOKIE,
  clearAdminSessionCookies,
  SessionCookieConfig,
  setAdminSessionCookies,
  setEnrollmentCookie,
} from "../auth/auth-cookies";
import { LoginDto } from "../auth/dto/login.dto";
import { ConfirmTwoFactorDto } from "../auth/dto/two-factor.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  AdminTwoFactorGuard,
  TwoFactorEnrollmentGuard,
} from "../common/guards/admin-two-factor.guard";
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
    clearAdminSessionCookies(response, this.cookieConfig());
    if ("enrollmentToken" in session) {
      setEnrollmentCookie(
        response,
        session.enrollmentToken,
        this.cookieConfig(),
      );
      return {
        user: session.user,
        requiresTwoFactorSetup: true,
      };
    }
    setAdminSessionCookies(response, session, this.cookieConfig());
    return { user: session.user };
  }

  @Post("refresh")
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const session = await this.authService.refreshSession(
        request.cookies?.[ADMIN_REFRESH_COOKIE],
        AuthSessionScope.STAFF,
      );
      setAdminSessionCookies(response, session, this.cookieConfig());
      return { user: session.user };
    } catch (error) {
      clearAdminSessionCookies(response, this.cookieConfig());
      throw error;
    }
  }

  @Post("logout")
  @UseGuards(OptionalJwtAuthGuard)
  async logout(
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
    @CurrentUser() user?: { sessionId: string },
  ) {
    if (user?.sessionId) {
      await this.authService.revokeSession(user.sessionId);
    } else {
      await this.authService.revokeRefreshSession(
        request.cookies?.[ADMIN_REFRESH_COOKIE],
        AuthSessionScope.STAFF,
      );
    }
    clearAdminSessionCookies(response, this.cookieConfig());
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard, AdminTwoFactorGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.KITCHEN)
  @Get("me")
  me(@CurrentUser() user: { id: string }) {
    return this.authService.me(user.id);
  }

  @UseGuards(TwoFactorEnrollmentGuard)
  @Post("2fa/setup")
  setupTwoFactor(@CurrentUser() user: { id: string }) {
    return this.authService.createTwoFactorSecret(user.id);
  }

  @UseGuards(TwoFactorEnrollmentGuard)
  @Post("2fa/confirm")
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async confirmTwoFactor(
    @CurrentUser() user: { id: string },
    @Body() dto: ConfirmTwoFactorDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.authService.confirmTwoFactor(user.id, dto.code);
    clearAdminSessionCookies(response, this.cookieConfig());
    setAdminSessionCookies(response, session, this.cookieConfig());
    return { user: session.user };
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
