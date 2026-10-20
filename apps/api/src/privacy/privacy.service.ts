import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DataDeletionRequestStatus, Role } from "@prisma/client";
import * as argon2 from "argon2";
import { randomBytes } from "node:crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { DataDeletionRequestDto } from "./dto/data-deletion-request.dto";
import { ResolveDeletionRequestDto } from "./dto/resolve-deletion-request.dto";

const openStatuses = [
  DataDeletionRequestStatus.VERIFICATION_REQUIRED,
  DataDeletionRequestStatus.VERIFIED,
  DataDeletionRequestStatus.PROCESSING,
];

@Injectable()
export class PrivacyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createDataDeletionRequest(
    dto: DataDeletionRequestDto,
    authenticatedUserId?: string,
  ) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.dataDeletionRequest.findFirst({
      where: { email, status: { in: openStatuses } },
      select: { id: true, status: true },
    });
    if (existing) {
      return { ok: true };
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    const identityVerified = Boolean(
      user &&
        user.role === Role.CLIENTE &&
        authenticatedUserId === user.id,
    );
    await this.prisma.dataDeletionRequest.create({
      data: {
        email,
        message: dto.message?.trim(),
        userId: user?.role === Role.CLIENTE ? user.id : null,
        status: identityVerified
          ? DataDeletionRequestStatus.VERIFIED
          : DataDeletionRequestStatus.VERIFICATION_REQUIRED,
        identityVerifiedAt: identityVerified ? new Date() : null,
      },
      select: { id: true, status: true },
    });

    return { ok: true };
  }

  listRequests() {
    return this.prisma.dataDeletionRequest.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        message: true,
        status: true,
        identityVerifiedAt: true,
        identityVerificationNote: true,
        resolutionNote: true,
        resolvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async verifyIdentity(requestId: string, actorId: string, note: string) {
    const request = await this.requireRequest(requestId);
    if (request.status !== DataDeletionRequestStatus.VERIFICATION_REQUIRED) {
      throw new BadRequestException("The request is not awaiting verification.");
    }

    const updated = await this.prisma.dataDeletionRequest.update({
      where: { id: requestId },
      data: {
        status: DataDeletionRequestStatus.VERIFIED,
        identityVerifiedAt: new Date(),
        identityVerificationNote: note.trim(),
      },
    });
    await this.audit.log({
      actorId,
      action: "privacy.deletion.identity_verified",
      entity: "data_deletion_request",
      entityId: requestId,
      metadata: { verificationNote: note.trim() },
    });
    return updated;
  }

  async resolveRequest(
    requestId: string,
    actorId: string,
    dto: ResolveDeletionRequestDto,
  ) {
    const request = await this.requireRequest(requestId);
    if (request.status !== DataDeletionRequestStatus.VERIFIED) {
      throw new BadRequestException(
        "Identity must be verified before resolving the request.",
      );
    }

    if (dto.decision === "REJECT") {
      const rejected = await this.prisma.$transaction(async (tx) => {
        await this.claimVerifiedRequest(tx, requestId);
        return tx.dataDeletionRequest.update({
          where: { id: requestId },
          data: {
            status: DataDeletionRequestStatus.REJECTED,
            resolutionNote: dto.note.trim(),
            resolvedById: actorId,
            resolvedAt: new Date(),
            resolved: true,
          },
        });
      });
      await this.audit.log({
        actorId,
        action: "privacy.deletion.rejected",
        entity: "data_deletion_request",
        entityId: requestId,
        metadata: { note: dto.note.trim() },
      });
      return rejected;
    }

    if (!request.userId) {
      throw new BadRequestException("The request has no linked customer account.");
    }

    const anonymizedEmail = `deleted+${request.userId}@anonymized.invalid`;
    const anonymizedPassword = await argon2.hash(
      randomBytes(32).toString("base64url"),
    );
    const completed = await this.prisma.$transaction(async (tx) => {
      await this.claimVerifiedRequest(tx, requestId);
      await tx.customerAddress.deleteMany({ where: { userId: request.userId! } });
      await tx.emailVerificationToken.deleteMany({ where: { userId: request.userId! } });
      await tx.passwordResetToken.deleteMany({ where: { userId: request.userId! } });
      await tx.authSession.deleteMany({ where: { userId: request.userId! } });
      await tx.loyaltyRedemption.deleteMany({ where: { userId: request.userId! } });
      await tx.customerCashTrust.deleteMany({ where: { userId: request.userId! } });
      await tx.order.updateMany({
        where: { userId: request.userId! },
        data: {
          userId: null,
          customerEmail: anonymizedEmail,
          customerName: "Cliente eliminado",
          customerPhone: "eliminado",
          deliveryName: null,
          deliveryPhone: null,
          deliveryStreet: null,
          deliveryCity: null,
          deliveryPostalCode: null,
          deliveryNotes: null,
        },
      });
      await tx.user.update({
        where: { id: request.userId! },
        data: {
          email: anonymizedEmail,
          name: "Cliente eliminado",
          phone: null,
          passwordHash: anonymizedPassword,
          active: false,
          disabledAt: new Date(),
          emailVerifiedAt: null,
          twoFactorSecret: null,
          twoFactorEnabled: false,
          acceptedLegalAt: null,
          legalVersion: null,
        },
      });
      return tx.dataDeletionRequest.update({
        where: { id: requestId },
        data: {
          email: `request+${requestId}@anonymized.invalid`,
          message: null,
          status: DataDeletionRequestStatus.COMPLETED,
          resolutionNote: dto.note.trim(),
          resolvedById: actorId,
          resolvedAt: new Date(),
          resolved: true,
        },
      });
    });

    await this.audit.log({
      actorId,
      action: "privacy.deletion.anonymized",
      entity: "data_deletion_request",
      entityId: requestId,
      metadata: {
        retained: ["order amounts", "payment records", "order item history"],
      },
    });
    return completed;
  }

  private async claimVerifiedRequest(
    tx: Pick<PrismaService, "dataDeletionRequest">,
    requestId: string,
  ) {
    const claimed = await tx.dataDeletionRequest.updateMany({
      where: {
        id: requestId,
        status: DataDeletionRequestStatus.VERIFIED,
      },
      data: { status: DataDeletionRequestStatus.PROCESSING },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException("The request is already being resolved.");
    }
  }

  private async requireRequest(id: string) {
    const request = await this.prisma.dataDeletionRequest.findUnique({
      where: { id },
    });
    if (!request) {
      throw new NotFoundException("Data deletion request not found.");
    }
    return request;
  }
}
