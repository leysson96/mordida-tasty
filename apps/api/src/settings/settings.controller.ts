import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { LEGAL_VERSION } from "../legal/legal-version";
import { DeliveryZonesService } from "./delivery-zones.service";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly deliveryZonesService: DeliveryZonesService,
  ) {}

  @Get("public")
  async publicSettings() {
    const [
      taxRate,
      deliveryFeeCents,
      openingHours,
      serviceStatus,
      siteContent,
      loyaltyProgram,
      deliveryZones,
    ] = await Promise.all([
      this.settingsService.getTaxRate(),
      this.settingsService.getDeliveryFeeCents(),
      this.settingsService.getOpeningHours(),
      this.settingsService.getServiceStatus(),
      this.settingsService.getSiteContent(),
      this.settingsService.getLoyaltyProgram(),
      this.deliveryZonesService.listPublicZones(),
    ]);

    return {
      taxRate,
      deliveryFeeCents,
      deliveryZones,
      openingHours,
      openNow: serviceStatus.openNow,
      serviceStatus,
      siteContent,
      loyaltyProgram,
      legalVersion: LEGAL_VERSION,
    };
  }

  @Get("delivery-quote")
  deliveryQuote(
    @Query("postalCode") postalCode?: string,
    @Query("subtotalCents") subtotalCents?: string,
  ) {
    const subtotal = Number(subtotalCents ?? 0);
    if (!Number.isInteger(subtotal) || subtotal < 0) {
      throw new BadRequestException("Subtotal must be a positive integer.");
    }

    return this.deliveryZonesService.quoteDelivery(postalCode, subtotal);
  }
}
