import { Body, Controller, Get, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AppEnv } from '../config/env';
import {
  clearSessionCookie,
  CLIENT_SESSION_COOKIE,
  SessionCookieConfig,
  setSessionCookie
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
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.authService.login(dto, Role.CLIENTE);
    setSessionCookie(response, CLIENT_SESSION_COOKIE, session.accessToken, this.cookieConfig());
    return { user: session.user };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    clearSessionCookie(response, CLIENT_SESSION_COOKIE, this.cookieConfig());
    return { ok: true };
  }

  @Post('request-password-reset')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('verify-email')
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
