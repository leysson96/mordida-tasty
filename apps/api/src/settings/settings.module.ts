import { Module } from "@nestjs/common";
import { DeliveryZonesService } from "./delivery-zones.service";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  controllers: [SettingsController],
  providers: [SettingsService, DeliveryZonesService],
  exports: [SettingsService, DeliveryZonesService],
})
export class SettingsModule {}
