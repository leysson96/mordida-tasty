import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { DeliveryMethod, OrderStatus, Role } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { AdminTwoFactorGuard } from "../common/guards/admin-two-factor.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProductsService } from "../products/products.service";
import { DeliveryZonesService } from "../settings/delivery-zones.service";
import { SettingsService } from "../settings/settings.service";
import { UploadsService } from "../uploads/uploads.service";
import { AdminController } from "./admin.controller";
import { AdminStaffController } from "./admin-staff.controller";
import { StaffService } from "./staff.service";

const request = require("supertest");

describe("Admin authorization E2E", () => {
  let app: INestApplication;

  const usersByToken = new Map([
    [
      "client-token",
      {
        id: "client-1",
        email: "cliente@mordidatasty.es",
        role: Role.CLIENTE,
        active: true,
        twoFactorEnabled: false,
      },
    ],
    [
      "kitchen-token",
      {
        id: "kitchen-1",
        email: "cocina@mordidatasty.es",
        role: Role.KITCHEN,
        active: true,
        twoFactorEnabled: false,
      },
    ],
    [
      "admin-token",
      {
        id: "admin-1",
        email: "admin@mordidatasty.es",
        role: Role.ADMIN,
        active: true,
        twoFactorEnabled: true,
      },
    ],
    [
      "admin-without-2fa-token",
      {
        id: "admin-no-2fa",
        email: "admin-sin-2fa@mordidatasty.es",
        role: Role.ADMIN,
        active: true,
        twoFactorEnabled: false,
      },
    ],
  ]);

  const jwtService = {
    verifyAsync: jest.fn(),
  };

  const prismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

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
    getServiceStatus: jest.fn(),
    getSiteContent: jest.fn(),
    getLoyaltyProgram: jest.fn(),
    getOrdersPause: jest.fn(),
    listSpecialClosures: jest.fn(),
    setTaxRate: jest.fn(),
    setDeliveryFeeCents: jest.fn(),
    setOpeningHours: jest.fn(),
    setOrdersPause: jest.fn(),
    setLoyaltyProgram: jest.fn(),
    listAdminZones: jest.fn(),
    listSpecialClosuresAdmin: jest.fn(),
    createSpecialClosure: jest.fn(),
    updateSpecialClosure: jest.fn(),
    deactivateSpecialClosure: jest.fn(),
    setSiteContent: jest.fn(),
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

  const staffService = {
    listStaff: jest.fn(),
    createStaff: jest.fn(),
    updateStaff: jest.fn(),
    setStaffActive: jest.fn(),
    resetTwoFactor: jest.fn(),
    requestPasswordReset: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    jwtService.verifyAsync.mockImplementation(async (token: string) => {
      const user = usersByToken.get(token);
      if (!user) {
        throw new Error("Invalid token");
      }

      return {
        sub: user.id,
        email: user.email,
        role: user.role,
      };
    });

    prismaService.user.findUnique.mockImplementation(
      async ({ where }: { where: { id: string } }) =>
        [...usersByToken.values()].find((user) => user.id === where.id) ??
        null,
    );

    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController, AdminStaffController],
      providers: [
        JwtAuthGuard,
        AdminTwoFactorGuard,
        RolesGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prismaService },
        { provide: OrdersService, useValue: ordersService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: ProductsService, useValue: productsService },
        { provide: SettingsService, useValue: settingsService },
        { provide: DeliveryZonesService, useValue: deliveryZonesService },
        { provide: UploadsService, useValue: uploadsService },
        { provide: AuditService, useValue: auditService },
        { provide: StaffService, useValue: staffService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function bearer(token: string) {
    return `Bearer ${token}`;
  }

  it("returns 401 when an admin route is called without a session", async () => {
    await request(app.getHttpServer()).get("/admin/products").expect(401);

    expect(productsService.listAdminProducts).not.toHaveBeenCalled();
  });

  it("blocks client tokens from admin routes", async () => {
    await request(app.getHttpServer())
      .get("/admin/products")
      .set("Authorization", bearer("client-token"))
      .expect(403);

    await request(app.getHttpServer())
      .patch("/admin/settings/orders-pause")
      .set("Authorization", bearer("client-token"))
      .send({ paused: true, reason: "Prueba" })
      .expect(403);

    await request(app.getHttpServer())
      .patch("/admin/settings/loyalty")
      .set("Authorization", bearer("client-token"))
      .send({ enabled: false })
      .expect(403);

    expect(productsService.listAdminProducts).not.toHaveBeenCalled();
    expect(settingsService.setOrdersPause).not.toHaveBeenCalled();
    expect(settingsService.setLoyaltyProgram).not.toHaveBeenCalled();
  });

  it("blocks kitchen tokens from admin-only management routes", async () => {
    await request(app.getHttpServer())
      .post("/admin/products")
      .set("Authorization", bearer("kitchen-token"))
      .send({
        categoryId: "category-1",
        name: "Producto privado",
        description: "No debe crearse desde cocina.",
        priceCents: 1000,
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch("/admin/settings/delivery-fee")
      .set("Authorization", bearer("kitchen-token"))
      .send({ deliveryFeeCents: 350 })
      .expect(403);

    await request(app.getHttpServer())
      .patch("/admin/settings/loyalty")
      .set("Authorization", bearer("kitchen-token"))
      .send({ enabled: true, goalOrders: 5 })
      .expect(403);

    await request(app.getHttpServer())
      .post("/admin/users")
      .set("Authorization", bearer("kitchen-token"))
      .send({
        name: "Nuevo staff",
        email: "staff@mordidatasty.es",
        password: "TempPassword123!",
        role: Role.KITCHEN,
      })
      .expect(403);

    expect(productsService.createProduct).not.toHaveBeenCalled();
    expect(settingsService.setDeliveryFeeCents).not.toHaveBeenCalled();
    expect(settingsService.setLoyaltyProgram).not.toHaveBeenCalled();
    expect(staffService.createStaff).not.toHaveBeenCalled();
  });

  it("allows kitchen tokens only for kitchen-safe order status changes", async () => {
    ordersService.transitionOrder.mockResolvedValue({
      id: "order-1",
      deliveryMethod: DeliveryMethod.PICKUP,
      status: OrderStatus.READY,
    });

    await request(app.getHttpServer())
      .patch("/admin/orders/order-1/status")
      .set("Authorization", bearer("kitchen-token"))
      .send({ status: OrderStatus.READY, note: "Listo para entregar" })
      .expect(200);

    await request(app.getHttpServer())
      .patch("/admin/orders/order-1/status")
      .set("Authorization", bearer("kitchen-token"))
      .send({ status: OrderStatus.CANCELLED, note: "No autorizado" })
      .expect(403);

    expect(ordersService.transitionOrder).toHaveBeenCalledTimes(1);
    expect(ordersService.transitionOrder).toHaveBeenCalledWith(
      "order-1",
      OrderStatus.READY,
      "kitchen-1",
      "Listo para entregar",
    );
  });

  it("blocks admin tokens until 2FA is enabled", async () => {
    await request(app.getHttpServer())
      .get("/admin/products")
      .set("Authorization", bearer("admin-without-2fa-token"))
      .expect(403);

    expect(productsService.listAdminProducts).not.toHaveBeenCalled();
  });

  it("allows fully authorized admin tokens on admin routes", async () => {
    productsService.listAdminProducts.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get("/admin/products")
      .set("Authorization", bearer("admin-token"))
      .expect(200, []);

    expect(productsService.listAdminProducts).toHaveBeenCalledTimes(1);
  });
});
