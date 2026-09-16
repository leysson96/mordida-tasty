import { Module } from "@nestjs/common";
import { PromotionsModule } from "../promotions/promotions.module";
import { DeliveryZonesService } from "./delivery-zones.service";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [PromotionsModule],
  controllers: [SettingsController],
  providers: [SettingsService, DeliveryZonesService],
  exports: [SettingsService, DeliveryZonesService],
})
export class SettingsModule {}
