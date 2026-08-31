import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { AuthModule } from "../auth/auth.module";
import { OrdersModule } from "../orders/orders.module";
import { PaymentsModule } from "../payments/payments.module";
import { ProductsModule } from "../products/products.module";
import { SettingsModule } from "../settings/settings.module";
import { UploadsModule } from "../uploads/uploads.module";
import { AdminAuthController } from "./admin-auth.controller";
import { AdminController } from "./admin.controller";
import { AdminTwoFactorGuard } from "../common/guards/admin-two-factor.guard";
import { AdminStaffController } from "./admin-staff.controller";
import { StaffService } from "./staff.service";

@Module({
  imports: [
    AuditModule,
    AuthModule,
    OrdersModule,
    PaymentsModule,
    ProductsModule,
    SettingsModule,
    UploadsModule,
  ],
  controllers: [AdminAuthController, AdminController, AdminStaffController],
  providers: [AdminTwoFactorGuard, StaffService],
})
export class AdminModule {}
