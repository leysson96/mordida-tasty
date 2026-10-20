import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminTwoFactorGuard } from '../common/guards/admin-two-factor.guard';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [PrivacyController],
  providers: [PrivacyService, AdminTwoFactorGuard]
})
export class PrivacyModule {}
