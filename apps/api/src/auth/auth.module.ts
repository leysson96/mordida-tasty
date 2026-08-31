import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppEnv } from '../config/env';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

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
  providers: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, OptionalJwtAuthGuard, RolesGuard]
})
export class AuthModule {}
