import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { AuthSessionScope, Role } from "@prisma/client";
import { AdminTwoFactorGuard } from "../common/guards/admin-two-factor.guard";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";
import { AdminCustomersController } from "./admin-customers.controller";
import { AdminCustomersService } from "./admin-customers.service";

const request = require("supertest");

describe("Admin customers authorization", () => {
  let app: INestApplication;
  const users = {
    admin: {
      id: "admin-1",
      email: "admin@example.test",
      role: Role.ADMIN,
      active: true,
      twoFactorEnabled: true,
    },
    kitchen: {
      id: "kitchen-1",
      email: "kitchen@example.test",
      role: Role.KITCHEN,
      active: true,
      twoFactorEnabled: true,
    },
    client: {
      id: "client-1",
      email: "client@example.test",
      role: Role.CLIENTE,
      active: true,
      twoFactorEnabled: false,
    },
  };
  const jwtService = {
    verifyAsync: jest.fn(async (token: keyof typeof users) => {
      const user = users[token];
      if (!user) throw new Error("invalid token");
      return { sub: user.id, email: user.email, role: user.role, sid: token };
    }),
  };
  const prisma = {
    authSession: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const user = users[where.id as keyof typeof users];
        return user
          ? {
              id: where.id,
              userId: user.id,
              scope:
                user.role === Role.CLIENTE
                  ? AuthSessionScope.CUSTOMER
                  : AuthSessionScope.STAFF,
              expiresAt: new Date(Date.now() + 60_000),
              absoluteExpiresAt: new Date(Date.now() + 120_000),
              revokedAt: null,
              user,
            }
          : null;
      }),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        Object.values(users).find((user) => user.id === where.id),
      ),
    },
  };
  const customers = {
    listCustomers: jest.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
    }),
    getCustomerDetail: jest.fn().mockResolvedValue({
      customer: { id: "123e4567-e89b-42d3-a456-426614174000" },
      orders: [],
    }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminCustomersController],
      providers: [
        JwtAuthGuard,
        AdminTwoFactorGuard,
        RolesGuard,
        { provide: JwtService, useValue: jwtService },
        { provide: PrismaService, useValue: prisma },
        { provide: AdminCustomersService, useValue: customers },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(() => app.close());

  it("returns 401 anonymously and 403 to client and kitchen roles", async () => {
    await request(app.getHttpServer()).get("/admin/customers").expect(401);
    await request(app.getHttpServer())
      .get("/admin/customers")
      .set("Authorization", "Bearer client")
      .expect(403);
    await request(app.getHttpServer())
      .get("/admin/customers")
      .set("Authorization", "Bearer kitchen")
      .expect(403);
  });

  it("allows a 2FA admin and validates pagination limits", async () => {
    await request(app.getHttpServer())
      .get("/admin/customers?page=1&pageSize=25")
      .set("Authorization", "Bearer admin")
      .expect(200);

    expect(customers.listCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25 }),
    );

    await request(app.getHttpServer())
      .get("/admin/customers?pageSize=101")
      .set("Authorization", "Bearer admin")
      .expect(400);
    await request(app.getHttpServer())
      .get("/admin/customers?status=UNKNOWN")
      .set("Authorization", "Bearer admin")
      .expect(400);
    await request(app.getHttpServer())
      .get("/admin/customers?source=UNKNOWN")
      .set("Authorization", "Bearer admin")
      .expect(400);
    await request(app.getHttpServer())
      .get("/admin/customers?source=GUEST")
      .set("Authorization", "Bearer admin")
      .expect(200);

    expect(customers.listCustomers).toHaveBeenLastCalledWith(
      expect.objectContaining({ source: "GUEST" }),
    );
  });

  it("protects the detail route and validates its pagination", async () => {
    const customerId = "123e4567-e89b-42d3-a456-426614174000";
    await request(app.getHttpServer())
      .get(`/admin/customers/${customerId}`)
      .set("Authorization", "Bearer kitchen")
      .expect(403);
    await request(app.getHttpServer())
      .get(`/admin/customers/${customerId}?page=2&pageSize=10`)
      .set("Authorization", "Bearer admin")
      .expect(200);

    expect(customers.getCustomerDetail).toHaveBeenCalledWith(
      customerId,
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );

    await request(app.getHttpServer())
      .get(`/admin/customers/${customerId}?pageSize=51`)
      .set("Authorization", "Bearer admin")
      .expect(400);
  });
});
