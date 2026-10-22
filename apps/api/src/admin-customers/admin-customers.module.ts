import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminTwoFactorGuard } from "../common/guards/admin-two-factor.guard";
import { CustomersModule } from "../customers/customers.module";
import { AdminCustomersController } from "./admin-customers.controller";
import { AdminCustomersService } from "./admin-customers.service";

@Module({
  imports: [AuthModule, CustomersModule],
  controllers: [AdminCustomersController],
  providers: [AdminCustomersService, AdminTwoFactorGuard],
})
export class AdminCustomersModule {}
