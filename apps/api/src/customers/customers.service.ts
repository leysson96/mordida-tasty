import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CommercialConsentSource,
  LoyaltyRedemptionStatus,
  OrderStatus,
} from "@prisma/client";
import { CashTrustService } from "../cash-trust/cash-trust.service";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "../settings/settings.service";
import { UpsertAddressDto } from "./dto/address.dto";
import { UpdateCommercialConsentsDto } from "./dto/commercial-consent.dto";
import {
  COMMERCIAL_CONSENT_CHANNELS,
  COMMERCIAL_CONSENT_VERSION,
} from "./commercial-consent.policy";

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly cashTrustService: CashTrustService,
  ) {}

  listAddresses(userId: string) {
    return this.prisma.customerAddress.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  }

  async createAddress(userId: string, dto: UpsertAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.create({
        data: {
          ...this.addressData(dto),
          userId,
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async updateAddress(
    userId: string,
    addressId: string,
    dto: UpsertAddressDto,
  ) {
    await this.ensureOwnedAddress(userId, addressId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.customerAddress.updateMany({
          where: { userId },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.update({
        where: { id: addressId },
        data: {
          ...this.addressData(dto),
          isDefault: dto.isDefault ?? false,
        },
      });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    await this.ensureOwnedAddress(userId, addressId);
    await this.prisma.customerAddress.delete({ where: { id: addressId } });
    return { ok: true };
  }

  async getLoyaltyProgress(userId: string) {
    const [program, completedOrders, usedRewards] = await Promise.all([
      this.settingsService.getLoyaltyProgram(),
      this.prisma.order.count({
        where: {
          userId,
          status: OrderStatus.DELIVERED,
        },
      }),
      this.prisma.loyaltyRedemption.count({
        where: {
          userId,
          status: {
            in: [
              LoyaltyRedemptionStatus.RESERVED,
              LoyaltyRedemptionStatus.APPLIED,
            ],
          },
        },
      }),
    ]);
    const earnedRewards = program.enabled
      ? Math.floor(completedOrders / program.goalOrders)
      : 0;
    const availableRewards = Math.max(0, earnedRewards - usedRewards);
    const rewardReady = program.enabled && availableRewards > 0;
    const completedOrdersAfterRedemptions = Math.max(
      0,
      completedOrders - usedRewards * program.goalOrders,
    );
    const rawProgress = completedOrdersAfterRedemptions % program.goalOrders;
    const progressOrders =
      rewardReady || (rawProgress === 0 && completedOrdersAfterRedemptions > 0)
        ? program.goalOrders
        : rawProgress;
    const progressPercent = program.enabled
      ? Math.round((progressOrders / program.goalOrders) * 100)
      : 0;

    return {
      program,
      completedOrders,
      progressOrders: program.enabled ? progressOrders : 0,
      progressPercent,
      ordersRemaining:
        program.enabled && !rewardReady
          ? Math.max(0, program.goalOrders - progressOrders)
          : 0,
      earnedRewards,
      usedRewards,
      availableRewards,
      rewardReady,
      rewardLabel:
        program.rewardType === "DISCOUNT_PERCENT"
          ? `${program.discountPercent}% de descuento`
          : program.freeProductName,
    };
  }

  getCashTrustState(userId: string) {
    return this.cashTrustService.getState(userId);
  }

  async getCommercialConsents(userId: string) {
    const records = await this.prisma.commercialConsent.findMany({
      where: { userId },
      orderBy: { channel: "asc" },
    });
    const byChannel = new Map(
      records.map((record) => [record.channel, record]),
    );

    return COMMERCIAL_CONSENT_CHANNELS.map((channel) => {
      const record = byChannel.get(channel);
      return {
        channel,
        granted: Boolean(record?.grantedAt && !record.withdrawnAt),
        grantedAt: record?.grantedAt ?? null,
        withdrawnAt: record?.withdrawnAt ?? null,
        consentVersion: record?.consentVersion ?? COMMERCIAL_CONSENT_VERSION,
        source: record?.source ?? null,
        withdrawalSource: record?.withdrawalSource ?? null,
        updatedAt: record?.updatedAt ?? null,
      };
    });
  }

  async updateCommercialConsents(
    userId: string,
    dto: UpdateCommercialConsentsDto,
  ) {
    const selected = new Set(dto.channels);
    const existing = await this.prisma.commercialConsent.findMany({
      where: { userId },
    });
    const byChannel = new Map(
      existing.map((record) => [record.channel, record]),
    );
    const now = new Date();

    await this.prisma.$transaction([
      ...COMMERCIAL_CONSENT_CHANNELS.map((channel) => {
        const previous = byChannel.get(channel);
        const granted = selected.has(channel);
        const data = granted
          ? {
              grantedAt:
                previous?.grantedAt && !previous.withdrawnAt
                  ? previous.grantedAt
                  : now,
              withdrawnAt: null,
              consentVersion: COMMERCIAL_CONSENT_VERSION,
              source: CommercialConsentSource.ACCOUNT,
              withdrawalSource: null,
            }
          : {
              grantedAt: previous?.grantedAt ?? null,
              withdrawnAt: previous?.withdrawnAt ?? now,
              consentVersion: COMMERCIAL_CONSENT_VERSION,
              source: previous?.source ?? CommercialConsentSource.ACCOUNT,
              withdrawalSource: CommercialConsentSource.ACCOUNT,
            };

        return this.prisma.commercialConsent.upsert({
          where: { userId_channel: { userId, channel } },
          create: { userId, channel, ...data },
          update: data,
        });
      }),
      this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: "commercial_consent.updated",
          entity: "CommercialConsent",
          entityId: userId,
          metadata: {
            consentVersion: COMMERCIAL_CONSENT_VERSION,
            previousGrantedChannels: existing
              .filter((record) => record.grantedAt && !record.withdrawnAt)
              .map((record) => record.channel),
            grantedChannels: dto.channels,
          },
        },
      }),
    ]);

    return this.getCommercialConsents(userId);
  }

  private async ensureOwnedAddress(userId: string, addressId: string) {
    const address = await this.prisma.customerAddress.findFirst({
      where: { id: addressId, userId },
    });

    if (!address) {
      throw new NotFoundException("Address not found.");
    }

    return address;
  }

  private addressData(dto: UpsertAddressDto) {
    return {
      label: dto.label.trim(),
      recipientName: dto.recipientName.trim(),
      phone: dto.phone.trim(),
      street: dto.street.trim(),
      city: dto.city.trim(),
      postalCode: dto.postalCode.trim(),
      notes: dto.notes?.trim(),
    };
  }
}
