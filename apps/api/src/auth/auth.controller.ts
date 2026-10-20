import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthSessionScope, Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AppEnv } from '../config/env';
import {
  clearCustomerSessionCookies,
  CLIENT_REFRESH_COOKIE,
  SessionCookieConfig,
  setCustomerSessionCookies
} from './auth-cookies';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto, ResetPasswordDto } from './dto/password-reset.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService<AppEnv, true>
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.login(dto, Role.CLIENTE);
    if (!("accessToken" in session)) {
      throw new Error("Customer login cannot create a 2FA enrollment session.");
    }
    setCustomerSessionCookies(response, session, this.cookieConfig());
    return { user: session.user };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const session = await this.authService.refreshSession(
        request.cookies?.[CLIENT_REFRESH_COOKIE],
        AuthSessionScope.CUSTOMER
      );
      setCustomerSessionCookies(response, session, this.cookieConfig());
      return { user: session.user };
    } catch (error) {
      clearCustomerSessionCookies(response, this.cookieConfig());
      throw error;
    }
  }

  @Post('logout')
  @UseGuards(OptionalJwtAuthGuard)
  async logout(
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
    @CurrentUser() user?: { sessionId: string }
  ) {
    if (user?.sessionId) {
      await this.authService.revokeSession(user.sessionId);
    } else {
      await this.authService.revokeRefreshSession(
        request.cookies?.[CLIENT_REFRESH_COOKIE],
        AuthSessionScope.CUSTOMER
      );
    }
    clearCustomerSessionCookies(response, this.cookieConfig());
    return { ok: true };
  }

  @Post('request-password-reset')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: { id: string }) {
    return this.authService.me(user.id);
  }

  private isProduction() {
    return this.configService.get('NODE_ENV', { infer: true }) === 'production';
  }

  private cookieConfig(): SessionCookieConfig {
    return {
      production: this.isProduction(),
      domain: this.configService.get('SESSION_COOKIE_DOMAIN', { infer: true }),
      sameSite: this.configService.get('SESSION_COOKIE_SAME_SITE', { infer: true })
    };
  }
}
