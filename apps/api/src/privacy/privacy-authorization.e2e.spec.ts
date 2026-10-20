import { INestApplication } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { AuthSessionScope, Role } from "@prisma/client";
import { AdminTwoFactorGuard } from "../common/guards/admin-two-factor.guard";
import { JwtAuthGuard, OptionalJwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { PrismaService } from "../prisma/prisma.service";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";

const request = require("supertest");

describe("privacy admin authorization E2E", () => {
  let app: INestApplication;
  const users = {
    admin: {
      id: "admin-1",
      email: "admin@mordida.test",
      role: Role.ADMIN,
      active: true,
      twoFactorEnabled: true,
    },
    kitchen: {
      id: "kitchen-1",
      email: "kitchen@mordida.test",
      role: Role.KITCHEN,
      active: true,
      twoFactorEnabled: true,
    },
  };
  const jwt = {
    verifyAsync: jest.fn(async (token: keyof typeof users) => {
      const user = users[token];
      if (!user) throw new Error("invalid");
      return { ...user, sub: user.id, sid: `session-${user.id}` };
    }),
  };
  const prisma = {
    authSession: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const user = Object.values(users).find(
          (candidate) => `session-${candidate.id}` === where.id,
        );
        return user
          ? {
              id: where.id,
              userId: user.id,
              scope: AuthSessionScope.STAFF,
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
  const privacy = {
    createDataDeletionRequest: jest.fn(),
    listRequests: jest.fn().mockResolvedValue([]),
    verifyIdentity: jest.fn(),
    resolveRequest: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PrivacyController],
      providers: [
        JwtAuthGuard,
        OptionalJwtAuthGuard,
        AdminTwoFactorGuard,
        RolesGuard,
        { provide: JwtService, useValue: jwt },
        { provide: PrismaService, useValue: prisma },
        { provide: PrivacyService, useValue: privacy },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it("rejects anonymous and kitchen users but allows a 2FA admin", async () => {
    await request(app.getHttpServer())
      .get("/privacy/admin/data-deletion-requests")
      .expect(401);
    await request(app.getHttpServer())
      .get("/privacy/admin/data-deletion-requests")
      .set("Authorization", "Bearer kitchen")
      .expect(403);
    await request(app.getHttpServer())
      .get("/privacy/admin/data-deletion-requests")
      .set("Authorization", "Bearer admin")
      .expect(200, []);
  });
});
