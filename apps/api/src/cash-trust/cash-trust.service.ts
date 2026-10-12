import { Injectable } from "@nestjs/common";
import {
  CashTrustEventType,
  CashTrustIncidentReason,
  CashTrustStatus,
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export const CASH_TRUST_INITIAL_REQUIRED_ORDERS = 2;
export const CASH_TRUST_RECOVERY_REQUIRED_ORDERS = 5;

type CashTrustRecord = {
  id: string;
  userId: string;
  status: CashTrustStatus;
  cashEnabled: boolean;
  successfulOrdersCount: number;
  requiredSuccessfulOrders: number;
  lastIncidentReason: CashTrustIncidentReason | null;
  lastIncidentAt: Date | null;
  unlockedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CashTrustPrismaClient = Pick<
  PrismaService,
  "customerCashTrust" | "cashTrustEvent"
>;

export type CashTrustState = {
  userId: string;
  status: CashTrustStatus;
  cashEnabled: boolean;
  successfulOrdersCount: number;
  requiredSuccessfulOrders: number;
  ordersRemaining: number;
  lastIncidentReason: CashTrustIncidentReason | null;
  lastIncidentAt: Date | null;
};

export type CashTrustIncidentInput = {
  userId: string;
  orderId?: string;
  reason: CashTrustIncidentReason;
  note?: string;
};

export type CashTrustSuccessfulOrderInput = {
  userId: string;
  orderId?: string;
};

@Injectable()
export class CashTrustService {
  constructor(private readonly prisma: PrismaService) {}

  async getState(userId: string): Promise<CashTrustState> {
    const trust = await getOrCreateTrust(this.prisma, userId);
    return toState(trust);
  }

  async canUseCash(userId: string): Promise<boolean> {
    const state = await this.getState(userId);
    return state.cashEnabled;
  }

  async recordSuccessfulOrder(
    input: CashTrustSuccessfulOrderInput,
  ): Promise<CashTrustState> {
    return this.prisma.$transaction((transaction) =>
      recordCashTrustSuccessfulOrder(transaction, input),
    );
  }

  async blockForIncident(
    input: CashTrustIncidentInput,
  ): Promise<CashTrustState> {
    return this.prisma.$transaction(async (transaction) => {
      const trust = await getOrCreateTrust(transaction, input.userId);
      const updated = await transaction.customerCashTrust.update({
        where: { id: trust.id },
        data: {
          status: CashTrustStatus.BLOCKED_INCIDENT,
          cashEnabled: false,
          successfulOrdersCount: 0,
          requiredSuccessfulOrders: CASH_TRUST_RECOVERY_REQUIRED_ORDERS,
          lastIncidentReason: input.reason,
          lastIncidentAt: new Date(),
          unlockedAt: null,
        },
      });

      await createEvent(transaction, {
        trust: updated,
        type: CashTrustEventType.CASH_BLOCKED,
        orderId: input.orderId,
        incidentReason: input.reason,
        successfulOrdersBefore: trust.successfulOrdersCount,
        successfulOrdersAfter: 0,
        cashEnabledAfter: false,
        note: input.note,
      });

      return toState(updated);
    });
  }
}

export async function recordCashTrustSuccessfulOrder(
  prisma: CashTrustPrismaClient,
  input: CashTrustSuccessfulOrderInput,
): Promise<CashTrustState> {
  const trust = await getOrCreateTrust(prisma, input.userId);

  if (trust.status === CashTrustStatus.ENABLED && trust.cashEnabled) {
    await createEvent(prisma, {
      trust,
      type: CashTrustEventType.ORDER_COMPLETED,
      orderId: input.orderId,
      successfulOrdersAfter: trust.successfulOrdersCount,
      cashEnabledAfter: true,
    });
    return toState(trust);
  }

  const successfulOrdersAfter = Math.min(
    trust.successfulOrdersCount + 1,
    trust.requiredSuccessfulOrders,
  );
  const shouldEnableCash =
    successfulOrdersAfter >= trust.requiredSuccessfulOrders;

  const updated = await prisma.customerCashTrust.update({
    where: { id: trust.id },
    data: {
      status: shouldEnableCash ? CashTrustStatus.ENABLED : trust.status,
      cashEnabled: shouldEnableCash,
      successfulOrdersCount: successfulOrdersAfter,
      unlockedAt: shouldEnableCash ? new Date() : trust.unlockedAt,
      lastIncidentReason: shouldEnableCash ? null : trust.lastIncidentReason,
      lastIncidentAt: shouldEnableCash ? null : trust.lastIncidentAt,
    },
  });

  await createEvent(prisma, {
    trust,
    type: CashTrustEventType.ORDER_COMPLETED,
    orderId: input.orderId,
    successfulOrdersAfter,
    cashEnabledAfter: updated.cashEnabled,
  });

  if (shouldEnableCash) {
    await createEvent(prisma, {
      trust: updated,
      type: CashTrustEventType.CASH_ENABLED,
      orderId: input.orderId,
      successfulOrdersBefore: trust.successfulOrdersCount,
      successfulOrdersAfter,
      cashEnabledAfter: true,
    });
  }

  return toState(updated);
}

async function getOrCreateTrust(
  prisma: CashTrustPrismaClient,
  userId: string,
): Promise<CashTrustRecord> {
  const existing = await prisma.customerCashTrust.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return prisma.customerCashTrust.create({
    data: {
      userId,
      status: CashTrustStatus.PENDING_ACTIVATION,
      cashEnabled: false,
      successfulOrdersCount: 0,
      requiredSuccessfulOrders: CASH_TRUST_INITIAL_REQUIRED_ORDERS,
    },
  });
}

async function createEvent(
  prisma: CashTrustPrismaClient,
  input: {
    trust: CashTrustRecord;
    type: CashTrustEventType;
    orderId?: string;
    incidentReason?: CashTrustIncidentReason;
    successfulOrdersBefore?: number;
    successfulOrdersAfter: number;
    cashEnabledAfter: boolean;
    note?: string;
  },
) {
  await prisma.cashTrustEvent.create({
    data: {
      trustId: input.trust.id,
      userId: input.trust.userId,
      orderId: input.orderId,
      type: input.type,
      incidentReason: input.incidentReason,
      successfulOrdersBefore:
        input.successfulOrdersBefore ?? input.trust.successfulOrdersCount,
      successfulOrdersAfter: input.successfulOrdersAfter,
      requiredSuccessfulOrders: input.trust.requiredSuccessfulOrders,
      cashEnabledAfter: input.cashEnabledAfter,
      note: input.note,
    },
  });
}

function toState(trust: CashTrustRecord): CashTrustState {
  return {
    userId: trust.userId,
    status: trust.status,
    cashEnabled: trust.cashEnabled,
    successfulOrdersCount: trust.successfulOrdersCount,
    requiredSuccessfulOrders: trust.requiredSuccessfulOrders,
    ordersRemaining: Math.max(
      trust.requiredSuccessfulOrders - trust.successfulOrdersCount,
      0,
    ),
    lastIncidentReason: trust.lastIncidentReason,
    lastIncidentAt: trust.lastIncidentAt,
  };
}
