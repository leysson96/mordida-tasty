import { BadRequestException } from "@nestjs/common";
import { DataDeletionRequestStatus, Role } from "@prisma/client";
import { PrivacyService } from "./privacy.service";

describe("PrivacyService", () => {
  const request = {
    id: "request-1",
    email: "client@mordida.test",
    message: null,
    status: DataDeletionRequestStatus.VERIFIED,
    userId: "client-1",
    identityVerifiedAt: new Date(),
    identityVerificationNote: "Cuenta autenticada",
    resolutionNote: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const prisma = {
    dataDeletionRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    user: { findUnique: jest.fn(), update: jest.fn() },
    customerAddress: { deleteMany: jest.fn() },
    emailVerificationToken: { deleteMany: jest.fn() },
    passwordResetToken: { deleteMany: jest.fn() },
    authSession: { deleteMany: jest.fn() },
    loyaltyRedemption: { deleteMany: jest.fn() },
    customerCashTrust: { deleteMany: jest.fn() },
    order: { updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.dataDeletionRequest.findFirst.mockResolvedValue(null);
    prisma.dataDeletionRequest.findUnique.mockResolvedValue(request);
    prisma.dataDeletionRequest.create.mockResolvedValue(request);
    prisma.dataDeletionRequest.update.mockResolvedValue({
      ...request,
      status: DataDeletionRequestStatus.COMPLETED,
    });
    prisma.dataDeletionRequest.updateMany.mockResolvedValue({ count: 1 });
    prisma.user.findUnique.mockResolvedValue({
      id: "client-1",
      email: request.email,
      role: Role.CLIENTE,
    });
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    audit.log.mockResolvedValue(undefined);
  });

  function service() {
    return new PrivacyService(prisma as never, audit as never);
  }

  it("does not create a duplicate open request", async () => {
    prisma.dataDeletionRequest.findFirst.mockResolvedValue({
      id: request.id,
      status: DataDeletionRequestStatus.VERIFICATION_REQUIRED,
    });

    await expect(
      service().createDataDeletionRequest({ email: request.email }),
    ).resolves.toEqual({ ok: true });
    expect(prisma.dataDeletionRequest.create).not.toHaveBeenCalled();
  });

  it("marks a matching authenticated customer request as verified", async () => {
    await service().createDataDeletionRequest(
      { email: ` ${request.email.toUpperCase()} ` },
      "client-1",
    );

    expect(prisma.dataDeletionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "client-1",
          status: DataDeletionRequestStatus.VERIFIED,
          identityVerifiedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("refuses anonymization before identity verification", async () => {
    prisma.dataDeletionRequest.findUnique.mockResolvedValue({
      ...request,
      status: DataDeletionRequestStatus.VERIFICATION_REQUIRED,
    });

    await expect(
      service().resolveRequest(request.id, "admin-1", {
        decision: "ANONYMIZE",
        note: "Identidad pendiente de verificar",
      }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("records how an admin verified identity", async () => {
    prisma.dataDeletionRequest.findUnique.mockResolvedValue({
      ...request,
      status: DataDeletionRequestStatus.VERIFICATION_REQUIRED,
    });

    await service().verifyIdentity(
      request.id,
      "admin-1",
      "Documento comprobado presencialmente",
    );
    expect(prisma.dataDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: request.id },
      data: expect.objectContaining({
        status: DataDeletionRequestStatus.VERIFIED,
        identityVerificationNote: "Documento comprobado presencialmente",
      }),
    });
  });

  it("allows a verified request without an account to be rejected", async () => {
    prisma.dataDeletionRequest.findUnique.mockResolvedValue({
      ...request,
      status: DataDeletionRequestStatus.VERIFICATION_REQUIRED,
      userId: null,
    });

    await expect(
      service().verifyIdentity(
        request.id,
        "admin-1",
        "Identidad comprobada; no existe una cuenta asociada",
      ),
    ).resolves.toBeDefined();
  });

  it("prevents two administrators from resolving the same request", async () => {
    prisma.dataDeletionRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service().resolveRequest(request.id, "admin-1", {
        decision: "ANONYMIZE",
        note: "Solicitud verificada y aprobada",
      }),
    ).rejects.toThrow("already being resolved");
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("anonymizes account data while retaining financial order records", async () => {
    await service().resolveRequest(request.id, "admin-1", {
      decision: "ANONYMIZE",
      note: "Solicitud verificada y aprobada",
    });

    expect(prisma.authSession.deleteMany).toHaveBeenCalledWith({
      where: { userId: "client-1" },
    });
    expect(prisma.order.updateMany).toHaveBeenCalledWith({
      where: { userId: "client-1" },
      data: expect.objectContaining({
        userId: null,
        customerName: "Cliente eliminado",
        deliveryStreet: null,
      }),
    });
    expect(prisma.dataDeletionRequest.update).toHaveBeenCalledWith({
      where: { id: request.id },
      data: expect.objectContaining({
        message: null,
        resolved: true,
        status: DataDeletionRequestStatus.COMPLETED,
      }),
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "client-1" },
      data: expect.objectContaining({
        active: false,
        phone: null,
        twoFactorSecret: null,
        passwordHash: expect.any(String),
      }),
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "privacy.deletion.anonymized",
        actorId: "admin-1",
      }),
    );
  });
});
