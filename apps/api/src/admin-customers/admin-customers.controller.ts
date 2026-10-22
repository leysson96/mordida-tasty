import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Role } from "@prisma/client";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminTwoFactorGuard } from "../common/guards/admin-two-factor.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { AdminCustomersService } from "./admin-customers.service";
import { CustomerHistoryQueryDto } from "./dto/customer-detail.dto";
import { ListAdminCustomersDto } from "./dto/list-admin-customers.dto";

@Controller("admin/customers")
@UseGuards(JwtAuthGuard, AdminTwoFactorGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminCustomersController {
  constructor(
    private readonly adminCustomersService: AdminCustomersService,
  ) {}

  @Get()
  listCustomers(@Query() query: ListAdminCustomersDto) {
    return this.adminCustomersService.listCustomers(query);
  }

  @Get(":id")
  getCustomer(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Query() query: CustomerHistoryQueryDto,
  ) {
    return this.adminCustomersService.getCustomerDetail(id, query);
  }
}
