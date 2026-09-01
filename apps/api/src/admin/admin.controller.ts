import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { DeliveryMethod, OrderStatus, Role } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { Request } from "express";
import { AuditService } from "../audit/audit.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { AdminTwoFactorGuard } from "../common/guards/admin-two-factor.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { OrdersService } from "../orders/orders.service";
import { UpdateOrderStatusDto } from "../orders/dto/update-order-status.dto";
import { PaymentsService } from "../payments/payments.service";
import {
  CreateCategoryDto,
  UpdateCategoryDto,
} from "../products/dto/category.dto";
import {
  CreateProductOptionChoiceDto,
  CreateProductOptionGroupDto,
  UpdateProductOptionChoiceDto,
  UpdateProductOptionGroupDto,
} from "../products/dto/product-options.dto";
import {
  CreateProductDto,
  ToggleAvailabilityDto,
  UpdateProductDto,
} from "../products/dto/product.dto";
import { ProductsService } from "../products/products.service";
import { DeliveryZonesService } from "../settings/delivery-zones.service";
import { SettingsService } from "../settings/settings.service";
import { UploadedImageFile, UploadsService } from "../uploads/uploads.service";
import {
  CreateDeliveryZoneDto,
  CreateSpecialClosureDto,
  UpdateDeliveryZoneDto,
  UpdateDeliveryFeeDto,
  UpdateLoyaltyProgramDto,
  UpdateOpeningHoursDto,
  UpdateOrdersPauseDto,
  UpdateSiteContentDto,
  UpdateSpecialClosureDto,
  UpdateTaxRateDto,
} from "./dto/settings.dto";
import { CancelOrderDto } from "./dto/cancel-order.dto";
import { RemoveOrderItemDto } from "./dto/remove-order-item.dto";

const kitchenStatusTargets = new Set<OrderStatus>([
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
]);

@UseGuards(JwtAuthGuard, AdminTwoFactorGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin")
export class AdminController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
    private readonly productsService: ProductsService,
    private readonly settingsService: SettingsService,
    private readonly deliveryZonesService: DeliveryZonesService,
    private readonly uploadsService: UploadsService,
    private readonly auditService: AuditService,
  ) {}

  @Get("dashboard")
  dashboard() {
    return this.ordersService.dashboardToday();
  }

  @Get("reports/sales")
  salesReport(@Query("from") from?: string, @Query("to") to?: string) {
    return this.ordersService.salesReport({ from, to });
  }

  @Get("orders")
  orders(
    @Query("status") status?: OrderStatus,
    @Query("today") today?: string,
    @Query("q") q?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("deliveryMethod") deliveryMethod?: DeliveryMethod,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.ordersService.listAdminOrders({
      status,
      today: today === "true",
      q,
      from,
      to,
      deliveryMethod,
      page,
      pageSize,
    });
  }

  @Get("orders/kitchen")
  @Roles(Role.ADMIN, Role.KITCHEN)
  kitchenOrders() {
    return this.ordersService.listKitchenOrders();
  }

  @Patch("orders/:id/status")
  @Roles(Role.ADMIN, Role.KITCHEN)
  async updateOrderStatus(
    @Param("id") id: string,
    @Body() dto: UpdateOrderStatusDto,
    @CurrentUser() user: { id: string; role: Role },
    @Req() request: Request,
  ) {
    if (user.role === Role.KITCHEN && !kitchenStatusTargets.has(dto.status)) {
      throw new ForbiddenException(
        "La cuenta de cocina no puede aplicar ese cambio de estado.",
      );
    }

    const order = await this.ordersService.transitionOrder(
      id,
      dto.status,
      user.id,
      dto.note,
    );
    await this.auditService.log({
      actorId: user.id,
      action: "order.status.update",
      entity: "order",
      entityId: id,
      metadata: { status: dto.status, note: dto.note },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return order;
  }

  @Patch("orders/:orderId/items/:itemId/remove")
  async removeOrderItem(
    @Param("orderId") orderId: string,
    @Param("itemId") itemId: string,
    @Body() dto: RemoveOrderItemDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const result = await this.paymentsService.removeOrderItemWithRefund({
      orderId,
      itemId,
      reason: dto.reason,
      actorId: user.id,
    });

    await this.auditService.log({
      actorId: user.id,
      action: "order.item.remove_refund",
      entity: "order",
      entityId: orderId,
      metadata: {
        itemId,
        reason: dto.reason,
        refundedCents: result.refundedCents,
        stripeRefundId: result.stripeRefundId,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return result.order;
  }

  @Patch("orders/:orderId/cancel-refund")
  async cancelOrderWithRefund(
    @Param("orderId") orderId: string,
    @Body() dto: CancelOrderDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const result = await this.paymentsService.cancelPaidOrderWithRefund({
      orderId,
      reason: dto.reason,
      actorId: user.id,
    });

    await this.auditService.log({
      actorId: user.id,
      action: "order.cancel_refund",
      entity: "order",
      entityId: orderId,
      metadata: {
        reason: dto.reason,
        refundedCents: result.refundedCents,
        stripeRefundId: result.stripeRefundId,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });

    return result.order;
  }

  @Get("products")
  products() {
    return this.productsService.listAdminProducts();
  }

  @Post("products")
  async createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const product = await this.productsService.createProduct(dto);
    await this.auditService.log({
      actorId: user.id,
      action: "product.create",
      entity: "product",
      entityId: product.id,
      metadata: { name: product.name, priceCents: product.priceCents },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return product;
  }

  @Patch("products/:id")
  async updateProduct(
    @Param("id") id: string,
    @Body() dto: UpdateProductDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const product = await this.productsService.updateProduct(id, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "product.update",
      entity: "product",
      entityId: id,
      metadata: dto as Prisma.InputJsonObject,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return product;
  }

  @Patch("products/:id/availability")
  async toggleAvailability(
    @Param("id") id: string,
    @Body() dto: ToggleAvailabilityDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const product = await this.productsService.toggleAvailability(id, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "product.availability.update",
      entity: "product",
      entityId: id,
      metadata: { available: dto.available },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return product;
  }

  @Post("products/:productId/option-groups")
  async createProductOptionGroup(
    @Param("productId") productId: string,
    @Body() dto: CreateProductOptionGroupDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const group = await this.productsService.createOptionGroup(productId, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "product.option_group.create",
      entity: "product_option_group",
      entityId: group.id,
      metadata: {
        productId,
        name: group.name,
        required: group.required,
        minChoices: group.minChoices,
        maxChoices: group.maxChoices,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return group;
  }

  @Patch("product-option-groups/:id")
  async updateProductOptionGroup(
    @Param("id") id: string,
    @Body() dto: UpdateProductOptionGroupDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const group = await this.productsService.updateOptionGroup(id, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "product.option_group.update",
      entity: "product_option_group",
      entityId: group.id,
      metadata: dto as Prisma.InputJsonObject,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return group;
  }

  @Delete("product-option-groups/:id")
  async deleteProductOptionGroup(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const group = await this.productsService.deactivateOptionGroup(id);
    await this.auditService.log({
      actorId: user.id,
      action: "product.option_group.deactivate",
      entity: "product_option_group",
      entityId: group.id,
      metadata: { name: group.name },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return group;
  }

  @Post("product-option-groups/:groupId/choices")
  async createProductOptionChoice(
    @Param("groupId") groupId: string,
    @Body() dto: CreateProductOptionChoiceDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const choice = await this.productsService.createOptionChoice(groupId, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "product.option_choice.create",
      entity: "product_option_choice",
      entityId: choice.id,
      metadata: {
        groupId,
        name: choice.name,
        priceCents: choice.priceCents,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return choice;
  }

  @Patch("product-option-choices/:id")
  async updateProductOptionChoice(
    @Param("id") id: string,
    @Body() dto: UpdateProductOptionChoiceDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const choice = await this.productsService.updateOptionChoice(id, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "product.option_choice.update",
      entity: "product_option_choice",
      entityId: choice.id,
      metadata: dto as Prisma.InputJsonObject,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return choice;
  }

  @Delete("product-option-choices/:id")
  async deleteProductOptionChoice(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const choice = await this.productsService.deactivateOptionChoice(id);
    await this.auditService.log({
      actorId: user.id,
      action: "product.option_choice.deactivate",
      entity: "product_option_choice",
      entityId: choice.id,
      metadata: { name: choice.name },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return choice;
  }

  @Get("categories")
  categories() {
    return this.productsService.listAdminCategories();
  }

  @Post("categories")
  async createCategory(
    @Body() dto: CreateCategoryDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const category = await this.productsService.createCategory(dto);
    await this.auditService.log({
      actorId: user.id,
      action: "category.create",
      entity: "category",
      entityId: category.id,
      metadata: { name: category.name, slug: category.slug },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return category;
  }

  @Patch("categories/:id")
  async updateCategory(
    @Param("id") id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const category = await this.productsService.updateCategory(id, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "category.update",
      entity: "category",
      entityId: id,
      metadata: dto as Prisma.InputJsonObject,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return category;
  }

  @Delete("categories/:id")
  async deleteCategory(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const category = await this.productsService.deactivateCategory(id);
    await this.auditService.log({
      actorId: user.id,
      action: "category.hide",
      entity: "category",
      entityId: id,
      metadata: { name: category.name },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return category;
  }

  @Get("settings")
  async settings() {
    const [
      taxRate,
      openingHours,
      deliveryFeeCents,
      serviceStatus,
      siteContent,
      loyaltyProgram,
      ordersPause,
      specialClosures,
      deliveryZones,
    ] = await Promise.all([
      this.settingsService.getTaxRate(),
      this.settingsService.getOpeningHours(),
      this.settingsService.getDeliveryFeeCents(),
      this.settingsService.getServiceStatus(),
      this.settingsService.getSiteContent(),
      this.settingsService.getLoyaltyProgram(),
      this.settingsService.getOrdersPause(),
      this.settingsService.listSpecialClosures(),
      this.deliveryZonesService.listAdminZones(),
    ]);

    return {
      taxRate,
      openingHours,
      deliveryFeeCents,
      deliveryZones,
      openNow: serviceStatus.openNow,
      serviceStatus,
      siteContent,
      loyaltyProgram,
      ordersPause,
      specialClosures,
    };
  }

  @Post("uploads/images")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: 10_485_760 } }),
  )
  async uploadImage(
    @UploadedFile() file: UploadedImageFile,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const image = await this.uploadsService.saveImage(file);
    await this.auditService.log({
      actorId: user.id,
      action: "upload.image",
      entity: "upload",
      metadata: {
        url: image.url,
        mimeType: image.mimeType,
        size: image.size,
        originalName: image.originalName,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return image;
  }

  @Patch("settings/tax-rate")
  async updateTaxRate(
    @Body() dto: UpdateTaxRateDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const setting = await this.settingsService.setTaxRate(dto.taxRate);
    await this.auditService.log({
      actorId: user.id,
      action: "settings.tax_rate.update",
      entity: "setting",
      entityId: "tax_rate",
      metadata: { taxRate: dto.taxRate },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return setting;
  }

  @Patch("settings/delivery-fee")
  async updateDeliveryFee(
    @Body() dto: UpdateDeliveryFeeDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const setting = await this.settingsService.setDeliveryFeeCents(
      dto.deliveryFeeCents,
    );
    await this.auditService.log({
      actorId: user.id,
      action: "settings.delivery_fee.update",
      entity: "setting",
      entityId: "delivery_fee_cents",
      metadata: { deliveryFeeCents: dto.deliveryFeeCents },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return setting;
  }

  @Patch("settings/opening-hours")
  async updateOpeningHours(
    @Body() dto: UpdateOpeningHoursDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const setting = await this.settingsService.setOpeningHours(
      dto.openingHours,
    );
    await this.auditService.log({
      actorId: user.id,
      action: "settings.opening_hours.update",
      entity: "setting",
      entityId: "opening_hours",
      metadata: dto.openingHours,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return setting;
  }

  @Patch("settings/orders-pause")
  async updateOrdersPause(
    @Body() dto: UpdateOrdersPauseDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const ordersPause = await this.settingsService.setOrdersPause({
      paused: dto.paused,
      reason: dto.reason ?? "",
    });
    const serviceStatus = await this.settingsService.getServiceStatus();
    await this.auditService.log({
      actorId: user.id,
      action: "settings.orders_pause.update",
      entity: "setting",
      entityId: "orders_paused",
      metadata: ordersPause,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return { ordersPause, serviceStatus, openNow: serviceStatus.openNow };
  }

  @Patch("settings/loyalty")
  async updateLoyaltyProgram(
    @Body() dto: UpdateLoyaltyProgramDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const loyaltyProgram = await this.settingsService.setLoyaltyProgram(dto);
    await this.auditService.log({
      actorId: user.id,
      action: "settings.loyalty.update",
      entity: "setting",
      entityId: "loyalty_program",
      metadata: loyaltyProgram as unknown as Prisma.InputJsonObject,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return loyaltyProgram;
  }

  @Get("special-closures")
  specialClosures() {
    return this.settingsService.listSpecialClosures();
  }

  @Post("special-closures")
  async createSpecialClosure(
    @Body() dto: CreateSpecialClosureDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const closure = await this.settingsService.createSpecialClosure(
      dto,
      user.id,
    );
    await this.auditService.log({
      actorId: user.id,
      action: "special_closure.create",
      entity: "special_closure",
      entityId: closure.id,
      metadata: {
        startsAt: closure.startsAt,
        endsAt: closure.endsAt,
        reason: closure.reason,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return closure;
  }

  @Patch("special-closures/:id")
  async updateSpecialClosure(
    @Param("id") id: string,
    @Body() dto: UpdateSpecialClosureDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const closure = await this.settingsService.updateSpecialClosure(id, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "special_closure.update",
      entity: "special_closure",
      entityId: closure.id,
      metadata: dto as Prisma.InputJsonObject,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return closure;
  }

  @Delete("special-closures/:id")
  async deleteSpecialClosure(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const closure = await this.settingsService.deactivateSpecialClosure(id);
    await this.auditService.log({
      actorId: user.id,
      action: "special_closure.deactivate",
      entity: "special_closure",
      entityId: closure.id,
      metadata: { reason: closure.reason },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return closure;
  }

  @Get("delivery-zones")
  deliveryZones() {
    return this.deliveryZonesService.listAdminZones();
  }

  @Post("delivery-zones")
  async createDeliveryZone(
    @Body() dto: CreateDeliveryZoneDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const zone = await this.deliveryZonesService.createZone(dto);
    await this.auditService.log({
      actorId: user.id,
      action: "delivery_zone.create",
      entity: "delivery_zone",
      entityId: zone.id,
      metadata: {
        name: zone.name,
        postalCodes: zone.postalCodes,
        deliveryFeeCents: zone.deliveryFeeCents,
        minimumOrderCents: zone.minimumOrderCents,
      },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return zone;
  }

  @Patch("delivery-zones/:id")
  async updateDeliveryZone(
    @Param("id") id: string,
    @Body() dto: UpdateDeliveryZoneDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const zone = await this.deliveryZonesService.updateZone(id, dto);
    await this.auditService.log({
      actorId: user.id,
      action: "delivery_zone.update",
      entity: "delivery_zone",
      entityId: zone.id,
      metadata: dto as Prisma.InputJsonObject,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return zone;
  }

  @Delete("delivery-zones/:id")
  async deleteDeliveryZone(
    @Param("id") id: string,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const zone = await this.deliveryZonesService.deactivateZone(id);
    await this.auditService.log({
      actorId: user.id,
      action: "delivery_zone.deactivate",
      entity: "delivery_zone",
      entityId: zone.id,
      metadata: { name: zone.name, postalCodes: zone.postalCodes },
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return zone;
  }

  @Patch("settings/site-content")
  async updateSiteContent(
    @Body() dto: UpdateSiteContentDto,
    @CurrentUser() user: { id: string },
    @Req() request: Request,
  ) {
    const siteContent = await this.settingsService.setSiteContent(dto);
    await this.auditService.log({
      actorId: user.id,
      action: "settings.site_content.update",
      entity: "setting",
      entityId: "site_content",
      metadata: siteContent as unknown as Prisma.InputJsonObject,
      ip: request.ip,
      userAgent: request.headers["user-agent"],
    });
    return siteContent;
  }
}
