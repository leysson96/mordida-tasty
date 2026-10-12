import {
  CashTrustEventType,
  CashTrustIncidentReason,
  CashTrustStatus,
} from "@prisma/client";
import {
  CASH_TRUST_INITIAL_REQUIRED_ORDERS,
  CASH_TRUST_RECOVERY_REQUIRED_ORDERS,
  CashTrustService,
} from "./cash-trust.service";

describe("CashTrustService", () => {
  const now = new Date("2026-10-11T12:00:00.000Z");
  let trust: CashTrustRecord | undefined;
  let events: Array<Record<string, unknown>>;

  const prisma = {
    customerCashTrust: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cashTrustEvent: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    trust = undefined;
    events = [];

    prisma.$transaction.mockImplementation(
      async (callback: (transaction: typeof prisma) => Promise<unknown>) =>
        callback(prisma),
    );
    prisma.customerCashTrust.findUnique.mockImplementation(
      async ({ where }: { where: { userId: string } }) =>
        trust?.userId === where.userId ? { ...trust } : null,
    );
    prisma.customerCashTrust.create.mockImplementation(
      async ({ data }: { data: Partial<CashTrustRecord> & { userId: string } }) => {
        trust = {
          id: "cash-trust-1",
          userId: data.userId,
          status: data.status ?? CashTrustStatus.PENDING_ACTIVATION,
          cashEnabled: data.cashEnabled ?? false,
          successfulOrdersCount: data.successfulOrdersCount ?? 0,
          requiredSuccessfulOrders:
            data.requiredSuccessfulOrders ??
            CASH_TRUST_INITIAL_REQUIRED_ORDERS,
          lastIncidentReason: data.lastIncidentReason ?? null,
          lastIncidentAt: data.lastIncidentAt ?? null,
          unlockedAt: data.unlockedAt ?? null,
          createdAt: now,
          updatedAt: now,
        };
        return { ...trust };
      },
    );
    prisma.customerCashTrust.update.mockImplementation(
      async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<CashTrustRecord>;
      }) => {
        if (!trust || trust.id !== where.id) {
          throw new Error("Missing trust record");
        }

        trust = {
          ...trust,
          ...data,
          updatedAt: now,
        };
        return { ...trust };
      },
    );
    prisma.cashTrustEvent.create.mockImplementation(
      async ({ data }: { data: Record<string, unknown> }) => {
        const event = {
          id: `cash-trust-event-${events.length + 1}`,
          ...data,
          createdAt: now,
        };
        events.push(event);
        return event;
      },
    );
  });

  function service() {
    return new CashTrustService(prisma as never);
  }

  function seedTrust(data: Partial<CashTrustRecord>) {
    trust = {
      id: "cash-trust-1",
      userId: "user-1",
      status: CashTrustStatus.PENDING_ACTIVATION,
      cashEnabled: false,
      successfulOrdersCount: 0,
      requiredSuccessfulOrders: CASH_TRUST_INITIAL_REQUIRED_ORDERS,
      lastIncidentReason: null,
      lastIncidentAt: null,
      unlockedAt: null,
      createdAt: now,
      updatedAt: now,
      ...data,
    };
  }

  it("starts new customers blocked from cash payments", async () => {
    await expect(service().getState("user-1")).resolves.toEqual({
      userId: "user-1",
      status: CashTrustStatus.PENDING_ACTIVATION,
      cashEnabled: false,
      successfulOrdersCount: 0,
      requiredSuccessfulOrders: CASH_TRUST_INITIAL_REQUIRED_ORDERS,
      ordersRemaining: CASH_TRUST_INITIAL_REQUIRED_ORDERS,
      lastIncidentReason: null,
      lastIncidentAt: null,
    });

    expect(prisma.customerCashTrust.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        status: CashTrustStatus.PENDING_ACTIVATION,
        cashEnabled: false,
        successfulOrdersCount: 0,
        requiredSuccessfulOrders: CASH_TRUST_INITIAL_REQUIRED_ORDERS,
      },
    });
  });

  it("enables cash after two successful orders", async () => {
    await expect(
      service().recordSuccessfulOrder({
        userId: "user-1",
        orderId: "order-1",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        cashEnabled: false,
        successfulOrdersCount: 1,
        ordersRemaining: 1,
      }),
    );

    await expect(
      service().recordSuccessfulOrder({
        userId: "user-1",
        orderId: "order-2",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: CashTrustStatus.ENABLED,
        cashEnabled: true,
        successfulOrdersCount: 2,
        ordersRemaining: 0,
      }),
    );

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: CashTrustEventType.ORDER_COMPLETED,
          orderId: "order-1",
          successfulOrdersAfter: 1,
          cashEnabledAfter: false,
        }),
        expect.objectContaining({
          type: CashTrustEventType.CASH_ENABLED,
          orderId: "order-2",
          successfulOrdersAfter: 2,
          cashEnabledAfter: true,
        }),
      ]),
    );
  });

  it("blocks cash after an incident and recovers it after five successful orders", async () => {
    seedTrust({
      status: CashTrustStatus.ENABLED,
      cashEnabled: true,
      successfulOrdersCount: 2,
      requiredSuccessfulOrders: CASH_TRUST_INITIAL_REQUIRED_ORDERS,
      unlockedAt: now,
    });

    await expect(
      service().blockForIncident({
        userId: "user-1",
        orderId: "cash-order-1",
        reason: CashTrustIncidentReason.NO_PICKUP,
        note: "No recogio el pedido.",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: CashTrustStatus.BLOCKED_INCIDENT,
        cashEnabled: false,
        successfulOrdersCount: 0,
        requiredSuccessfulOrders: CASH_TRUST_RECOVERY_REQUIRED_ORDERS,
        ordersRemaining: CASH_TRUST_RECOVERY_REQUIRED_ORDERS,
        lastIncidentReason: CashTrustIncidentReason.NO_PICKUP,
      }),
    );

    for (let index = 1; index <= 4; index += 1) {
      await expect(
        service().recordSuccessfulOrder({
          userId: "user-1",
          orderId: `recovery-order-${index}`,
        }),
      ).resolves.toEqual(
        expect.objectContaining({
          status: CashTrustStatus.BLOCKED_INCIDENT,
          cashEnabled: false,
          successfulOrdersCount: index,
          ordersRemaining: CASH_TRUST_RECOVERY_REQUIRED_ORDERS - index,
        }),
      );
    }

    await expect(
      service().recordSuccessfulOrder({
        userId: "user-1",
        orderId: "recovery-order-5",
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        status: CashTrustStatus.ENABLED,
        cashEnabled: true,
        successfulOrdersCount: CASH_TRUST_RECOVERY_REQUIRED_ORDERS,
        ordersRemaining: 0,
        lastIncidentReason: null,
      }),
    );

    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: CashTrustEventType.CASH_BLOCKED,
          orderId: "cash-order-1",
          incidentReason: CashTrustIncidentReason.NO_PICKUP,
          successfulOrdersBefore: 2,
          successfulOrdersAfter: 0,
          requiredSuccessfulOrders: CASH_TRUST_RECOVERY_REQUIRED_ORDERS,
          cashEnabledAfter: false,
        }),
        expect.objectContaining({
          type: CashTrustEventType.CASH_ENABLED,
          orderId: "recovery-order-5",
          successfulOrdersAfter: CASH_TRUST_RECOVERY_REQUIRED_ORDERS,
          cashEnabledAfter: true,
        }),
      ]),
    );
  });
});

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
