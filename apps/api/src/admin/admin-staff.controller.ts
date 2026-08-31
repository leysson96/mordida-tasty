import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Prisma, Role } from "@prisma/client";
import { Request } from "express";
import { AuditService } from "../audit/audit.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminTwoFactorGuard } from "../common/guards/admin-two-factor.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import {
  CreateStaffUserDto,
  UpdateStaffStatusDto,
  UpdateStaffUserDto,
} from "./dto/staff.dto";
import { StaffService } from "./staff.service";

@UseGuards(JwtAuthGuard, AdminTwoFactorGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin/users")
export class AdminStaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  list(@Query("role") role?: Role) {
    return this.staffService.listStaff(role);
  }

  @Post()
  async create(
    @Body() dto: CreateStaffUserDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const staff = await this.staffService.createStaff(dto);
    await this.auditService.log({
      actorId: user.id,
      action: "staff.create",
      entity: "user",
      entityId: staff.id,
      metadata: { email: staff.email, role: staff.role },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return staff;
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateStaffUserDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const staff = await this.staffService.updateStaff(id, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "staff.update",
      entity: "user",
      entityId: staff.id,
      metadata: dto as Prisma.InputJsonObject,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return staff;
  }

  @Patch(":id/status")
  async updateStatus(
    @Param("id") id: string,
    @Body() dto: UpdateStaffStatusDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const staff = await this.staffService.setStaffActive({
      actorId: user.id,
      staffId: id,
      active: dto.active,
    });
    await this.auditService.log({
      actorId: user.id,
      action: "staff.status.update",
      entity: "user",
      entityId: staff.id,
      metadata: { active: staff.active },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return staff;
  }

  @Post(":id/reset-2fa")
  async resetTwoFactor(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const staff = await this.staffService.resetTwoFactor(id);
    await this.auditService.log({
      actorId: user.id,
      action: "staff.2fa.reset",
      entity: "user",
      entityId: staff.id,
      metadata: { email: staff.email },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return staff;
  }

  @Post(":id/password-reset")
  async requestPasswordReset(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const result = await this.staffService.requestPasswordReset(id);
    await this.auditService.log({
      actorId: user.id,
      action: "staff.password_reset.request",
      entity: "user",
      entityId: id,
      metadata: { sent: true },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return result;
  }
}
