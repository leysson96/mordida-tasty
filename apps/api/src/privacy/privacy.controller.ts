import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { DataDeletionRequestDto } from "./dto/data-deletion-request.dto";
import { PrivacyService } from "./privacy.service";

@Controller("privacy")
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Post("data-deletion-requests")
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  requestDeletion(@Body() dto: DataDeletionRequestDto) {
    return this.privacyService.createDataDeletionRequest(dto);
  }
}
