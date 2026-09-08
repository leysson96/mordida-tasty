import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { OrdersModule } from "../orders/orders.module";
import { SettingsModule } from "../settings/settings.module";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [MailModule, OrdersModule, SettingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
