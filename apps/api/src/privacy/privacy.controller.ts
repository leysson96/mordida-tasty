import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminTwoFactorGuard } from "../common/guards/admin-two-factor.guard";
import {
  JwtAuthGuard,
  OptionalJwtAuthGuard,
} from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { DataDeletionRequestDto } from "./dto/data-deletion-request.dto";
import { ResolveDeletionRequestDto } from "./dto/resolve-deletion-request.dto";
import { VerifyDeletionRequestDto } from "./dto/verify-deletion-request.dto";
import { PrivacyService } from "./privacy.service";

@Controller("privacy")
export class PrivacyController {
  constructor(private readonly privacyService: PrivacyService) {}

  @Post("data-deletion-requests")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 3, ttl: 10 * 60_000 } })
  requestDeletion(
    @Body() dto: DataDeletionRequestDto,
    @CurrentUser() user?: { id: string },
  ) {
    return this.privacyService.createDataDeletionRequest(dto, user?.id);
  }

  @Get("admin/data-deletion-requests")
  @UseGuards(JwtAuthGuard, AdminTwoFactorGuard, RolesGuard)
  @Roles(Role.ADMIN)
  listRequests() {
    return this.privacyService.listRequests();
  }

  @Patch("admin/data-deletion-requests/:id/verify")
  @UseGuards(JwtAuthGuard, AdminTwoFactorGuard, RolesGuard)
  @Roles(Role.ADMIN)
  verifyIdentity(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: VerifyDeletionRequestDto,
  ) {
    return this.privacyService.verifyIdentity(id, user.id, dto.note);
  }

  @Patch("admin/data-deletion-requests/:id/resolve")
  @UseGuards(JwtAuthGuard, AdminTwoFactorGuard, RolesGuard)
  @Roles(Role.ADMIN)
  resolve(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ResolveDeletionRequestDto,
  ) {
    return this.privacyService.resolveRequest(id, user.id, dto);
  }
}
