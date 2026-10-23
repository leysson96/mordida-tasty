import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppEnv } from '../config/env';
import {
  GuestOrCustomerJwtAuthGuard,
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TwoFactorEnrollmentGuard } from '../common/guards/admin-two-factor.guard';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TotpCryptoService } from './totp-crypto.service';

@Module({
  imports: [
    MailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AppEnv, true>) => ({
        secret: configService.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN', { infer: true })
        }
      })
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TotpCryptoService,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    GuestOrCustomerJwtAuthGuard,
    RolesGuard,
    TwoFactorEnrollmentGuard
  ],
  exports: [
    AuthService,
    JwtModule,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    GuestOrCustomerJwtAuthGuard,
    RolesGuard,
    TwoFactorEnrollmentGuard
  ]
})
export class AuthModule {}
