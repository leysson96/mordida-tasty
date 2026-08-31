import { ForbiddenException } from "@nestjs/common";
import { DeliveryMethod, OrderStatus, Role } from "@prisma/client";
import { AdminController } from "./admin.controller";

describe("AdminController", () => {
  const ordersService = {
    dashboardToday: jest.fn(),
    salesReport: jest.fn(),
    listAdminOrders: jest.fn(),
    listKitchenOrders: jest.fn(),
    transitionOrder: jest.fn(),
  };

  const paymentsService = {
    removeOrderItemWithRefund: jest.fn(),
    cancelPaidOrderWithRefund: jest.fn(),
  };

  const productsService = {
    listAdminProducts: jest.fn(),
    createProduct: jest.fn(),
    updateProduct: jest.fn(),
    toggleAvailability: jest.fn(),
    createOptionGroup: jest.fn(),
    updateOptionGroup: jest.fn(),
    deactivateOptionGroup: jest.fn(),
    createOptionChoice: jest.fn(),
    updateOptionChoice: jest.fn(),
    deactivateOptionChoice: jest.fn(),
    listAdminCategories: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    deactivateCategory: jest.fn(),
  };

  const settingsService = {
    getTaxRate: jest.fn(),
    getOpeningHours: jest.fn(),
    getDeliveryFeeCents: jest.fn(),
    isOpenNow: jest.fn(),
    getSiteContent: jest.fn(),
    getOrdersPause: jest.fn(),
    listSpecialClosures: jest.fn(),
    setTaxRate: jest.fn(),
    setDeliveryFeeCents: jest.fn(),
    setOpeningHours: jest.fn(),
    setSiteContent: jest.fn(),
    setOrdersPause: jest.fn(),
    getServiceStatus: jest.fn(),
    createSpecialClosure: jest.fn(),
    updateSpecialClosure: jest.fn(),
    deactivateSpecialClosure: jest.fn(),
  };

  const deliveryZonesService = {
    listAdminZones: jest.fn(),
    createZone: jest.fn(),
    updateZone: jest.fn(),
    deactivateZone: jest.fn(),
  };

  const uploadsService = {
    saveImage: jest.fn(),
  };

  const auditService = {
    log: jest.fn(),
  };

  const request = {
    ip: "127.0.0.1",
    headers: { "user-agent": "jest" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function controller() {
    return new AdminController(
      ordersService as never,
      paymentsService as never,
      productsService as never,
      settingsService as never,
      deliveryZonesService as never,
      uploadsService as never,
      auditService as never,
    );
  }

  it("blocks kitchen users from applying non-kitchen status changes", async () => {
    await expect(
      controller().updateOrderStatus(
        "order-1",
        { status: OrderStatus.CANCELLED },
        { id: "kitchen-1", role: Role.KITCHEN },
        request as never,
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(ordersService.transitionOrder).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it("lets kitchen users advance orders through the kitchen flow", async () => {
    const order = { id: "order-1", status: OrderStatus.READY };
    ordersService.transitionOrder.mockResolvedValue(order);

    await expect(
      controller().updateOrderStatus(
        "order-1",
        { status: OrderStatus.READY, note: "Pedido listo" },
        { id: "kitchen-1", role: Role.KITCHEN },
        request as never,
      ),
    ).resolves.toBe(order);

    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.READY,
      "kitchen-1",
      "Pedido listo",
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "kitchen-1",
        action: "order.status.update",
        metadata: { status: OrderStatus.READY, note: "Pedido listo" },
      }),
    );
  });

  it("logs refund metadata when an admin removes a paid order item", async () => {
    const order = { id: "order-1", totalCents: 390 };
    paymentsService.removeOrderItemWithRefund.mockResolvedValue({
      order,
      refundedCents: 1190,
      stripeRefundId: "re_123",
    });

    await expect(
      controller().removeOrderItem(
        "order-1",
        "item-1",
        { reason: "Sin stock" },
        { id: "admin-1" },
        request as never,
      ),
    ).resolves.toBe(order);

    expect(paymentsService.removeOrderItemWithRefund).toHaveBeenCalledWith({
      orderId: "order-1",
      itemId: "item-1",
      reason: "Sin stock",
      actorId: "admin-1",
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "order.item.remove_refund",
        metadata: expect.objectContaining({
          itemId: "item-1",
          refundedCents: 1190,
          stripeRefundId: "re_123",
        }),
      }),
    );
  });

  it("logs refund metadata when an admin cancels a paid order", async () => {
    const order = { id: "order-1", status: OrderStatus.CANCELLED };
    paymentsService.cancelPaidOrderWithRefund.mockResolvedValue({
      order,
      refundedCents: 1440,
      stripeRefundId: "re_full",
    });

    await expect(
      controller().cancelOrderWithRefund(
        "order-1",
        { reason: "Cliente solicita cancelacion" },
        { id: "admin-1" },
        request as never,
      ),
    ).resolves.toBe(order);

    expect(paymentsService.cancelPaidOrderWithRefund).toHaveBeenCalledWith({
      orderId: "order-1",
      reason: "Cliente solicita cancelacion",
      actorId: "admin-1",
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "order.cancel_refund",
        entityId: "order-1",
        metadata: {
          reason: "Cliente solicita cancelacion",
          refundedCents: 1440,
          stripeRefundId: "re_full",
        },
      }),
    );
  });

  it("passes admin order filters through to the orders service", async () => {
    ordersService.listAdminOrders.mockResolvedValue([]);

    await expect(
      controller().orders(
        OrderStatus.PAID,
        "false",
        "leysson",
        "2026-08-01",
        "2026-08-02",
        DeliveryMethod.DELIVERY,
        "2",
        "25",
      ),
    ).resolves.toEqual([]);

    expect(ordersService.listAdminOrders).toHaveBeenCalledWith({
      status: OrderStatus.PAID,
      today: false,
      q: "leysson",
      from: "2026-08-01",
      to: "2026-08-02",
      deliveryMethod: DeliveryMethod.DELIVERY,
      page: "2",
      pageSize: "25",
    });
  });

  it("creates product option groups and writes an audit entry", async () => {
    const group = {
      id: "group-1",
      name: "Extras",
      required: false,
      minChoices: 0,
      maxChoices: 3,
    };
    productsService.createOptionGroup.mockResolvedValue(group);

    await expect(
      controller().createProductOptionGroup(
        "product-1",
        { name: "Extras", required: false, maxChoices: 3 },
        { id: "admin-1" },
        request as never,
      ),
    ).resolves.toBe(group);

    expect(productsService.createOptionGroup).toHaveBeenCalledWith(
      "product-1",
      { name: "Extras", required: false, maxChoices: 3 },
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "product.option_group.create",
        entity: "product_option_group",
        entityId: "group-1",
        metadata: {
          productId: "product-1",
          name: "Extras",
          required: false,
          minChoices: 0,
          maxChoices: 3,
        },
      }),
    );
  });

  it("updates the manual orders pause and logs the change", async () => {
    settingsService.setOrdersPause.mockResolvedValue({
      paused: true,
      reason: "Cerrado por mantenimiento.",
    });
    settingsService.getServiceStatus.mockResolvedValue({
      openNow: false,
      reason: "Cerrado por mantenimiento.",
      pause: {
        paused: true,
        reason: "Cerrado por mantenimiento.",
      },
    });

    await expect(
      controller().updateOrdersPause(
        { paused: true, reason: "Cerrado por mantenimiento." },
        { id: "admin-1" },
        request as never,
      ),
    ).resolves.toEqual({
      ordersPause: {
        paused: true,
        reason: "Cerrado por mantenimiento.",
      },
      serviceStatus: {
        openNow: false,
        reason: "Cerrado por mantenimiento.",
        pause: {
          paused: true,
          reason: "Cerrado por mantenimiento.",
        },
      },
      openNow: false,
    });

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "settings.orders_pause.update",
        entityId: "orders_paused",
        metadata: {
          paused: true,
          reason: "Cerrado por mantenimiento.",
        },
      }),
    );
  });

  it("creates a special closure and logs the visible reason", async () => {
    const closure = {
      id: "closure-1",
      startsAt: new Date("2026-09-01T10:00:00.000Z"),
      endsAt: new Date("2026-09-01T14:00:00.000Z"),
      reason: "Evento privado.",
      active: true,
      createdById: "admin-1",
      createdAt: new Date("2026-08-30T10:00:00.000Z"),
      updatedAt: new Date("2026-08-30T10:00:00.000Z"),
    };
    settingsService.createSpecialClosure.mockResolvedValue(closure);

    await expect(
      controller().createSpecialClosure(
        {
          startsAt: "2026-09-01T10:00:00.000Z",
          endsAt: "2026-09-01T14:00:00.000Z",
          reason: "Evento privado.",
        },
        { id: "admin-1" },
        request as never,
      ),
    ).resolves.toBe(closure);

    expect(settingsService.createSpecialClosure).toHaveBeenCalledWith(
      {
        startsAt: "2026-09-01T10:00:00.000Z",
        endsAt: "2026-09-01T14:00:00.000Z",
        reason: "Evento privado.",
      },
      "admin-1",
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "special_closure.create",
        entityId: "closure-1",
        metadata: {
          startsAt: closure.startsAt,
          endsAt: closure.endsAt,
          reason: "Evento privado.",
        },
      }),
    );
  });

  it("creates a delivery zone and writes an audit entry", async () => {
    const zone = {
      id: "zone-1",
      name: "Centro",
      postalCodes: ["15001", "150*"],
      deliveryFeeCents: 350,
      minimumOrderCents: 1200,
      active: true,
      sortOrder: 0,
      createdAt: new Date("2026-08-30T10:00:00.000Z"),
      updatedAt: new Date("2026-08-30T10:00:00.000Z"),
    };
    deliveryZonesService.createZone.mockResolvedValue(zone);

    await expect(
      controller().createDeliveryZone(
        {
          name: "Centro",
          postalCodes: ["15001", "150*"],
          deliveryFeeCents: 350,
          minimumOrderCents: 1200,
        },
        { id: "admin-1" },
        request as never,
      ),
    ).resolves.toBe(zone);

    expect(deliveryZonesService.createZone).toHaveBeenCalledWith({
      name: "Centro",
      postalCodes: ["15001", "150*"],
      deliveryFeeCents: 350,
      minimumOrderCents: 1200,
    });
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "admin-1",
        action: "delivery_zone.create",
        entityId: "zone-1",
        metadata: {
          name: "Centro",
          postalCodes: ["15001", "150*"],
          deliveryFeeCents: 350,
          minimumOrderCents: 1200,
        },
      }),
    );
  });
});
