import type {
  AdminCustomerDetailResponse,
  AdminCustomerListItem,
  AdminCustomerSegmentKey,
} from "../apps/web/lib/types";

const now = "2026-10-22T12:00:00.000Z";
const recentPurchase = "2026-10-20T19:15:00.000Z";

interface CustomerScenario {
  customer: AdminCustomerListItem;
  detail: AdminCustomerDetailResponse;
}

export const crmScenarios = {
  new: scenario({
    sequence: 1,
    name: "Cliente Nuevo",
    segment: "NEW",
    deliveredOrders: 0,
    totalSpentCents: 0,
    lastPurchaseAt: null,
  }),
  developing: scenario({
    sequence: 2,
    name: "Cliente En Desarrollo",
    segment: "DEVELOPING",
    deliveredOrders: 2,
    totalSpentCents: 2450,
  }),
  active: scenario({
    sequence: 3,
    name: "Cliente Activo",
    segment: "ACTIVE",
    deliveredOrders: 4,
    totalSpentCents: 5180,
  }),
  frequent: scenario({
    sequence: 4,
    name: "Cliente Frecuente",
    segment: "FREQUENT",
    deliveredOrders: 8,
    cancelledOrders: 1,
    totalSpentCents: 11240,
    consents: true,
  }),
  inactive: scenario({
    sequence: 5,
    name: "Cliente Inactivo",
    segment: "INACTIVE",
    deliveredOrders: 6,
    totalSpentCents: 8940,
    lastPurchaseAt: "2026-05-01T19:00:00.000Z",
  }),
  disabled: scenario({
    sequence: 6,
    name: "Cliente Desactivado",
    segment: "ACTIVE",
    deliveredOrders: 3,
    totalSpentCents: 4390,
    active: false,
  }),
  anonymized: scenario({
    sequence: 7,
    name: "Cliente eliminado",
    segment: "INACTIVE",
    deliveredOrders: 5,
    totalSpentCents: 7250,
    email: "deleted-7@anonymized.invalid",
    phone: null,
    lastPurchaseAt: "2026-01-10T13:00:00.000Z",
  }),
} satisfies Record<string, CustomerScenario>;

export function representativeCustomerList(size = 1_500) {
  const seeds = Object.values(crmScenarios).map(({ customer }) => customer);
  return Array.from({ length: size }, (_, index) => {
    const sequence = index + 1;
    if (index < seeds.length) {
      return seeds[index];
    }
    const seed = seeds[2];
    return {
      ...seed,
      id: customerId(sequence),
      displayId: `CLI-${String(sequence).padStart(8, "0")}`,
      name: `Cliente Demo ${sequence}`,
      maskedEmail: `cl***${String(sequence).slice(-2).padStart(2, "0")}@example.test`,
      anonymized: false,
    };
  });
}

export function representativeGuestList(): AdminCustomerListItem[] {
  return [
    {
      id: "INV-12AB34CD56",
      displayId: "INV-12AB34CD56",
      name: "Compra Invitada",
      accountType: "GUEST",
      verificationStatus: "GUEST",
      maskedEmail: "co***da@example.test",
      maskedPhone: "+34*****2804",
      postalCode: "15001",
      anonymized: false,
      active: true,
      createdAt: "2026-10-01T10:00:00.000Z",
      lastLoginAt: null,
      lastPurchaseAt: recentPurchase,
      deliveredOrders: 2,
      cancelledOrders: 0,
      totalSpentCents: 3000,
      averageTicketCents: 1500,
    },
  ];
}

function scenario(input: {
  sequence: number;
  name: string;
  segment: AdminCustomerSegmentKey;
  deliveredOrders: number;
  totalSpentCents: number;
  cancelledOrders?: number;
  lastPurchaseAt?: string | null;
  active?: boolean;
  email?: string;
  phone?: string | null;
  consents?: boolean;
}): CustomerScenario {
  const id = customerId(input.sequence);
  const active = input.active ?? true;
  const email = input.email ?? `cliente.${input.sequence}@example.test`;
  const phone = input.phone === undefined ? "+34610000000" : input.phone;
  const lastPurchaseAt =
    input.lastPurchaseAt === undefined ? recentPurchase : input.lastPurchaseAt;
  const cancelledOrders = input.cancelledOrders ?? 0;
  const averageTicketCents = input.deliveredOrders
    ? Math.round(input.totalSpentCents / input.deliveredOrders)
    : 0;

  const customer: AdminCustomerListItem = {
    id,
    displayId: `CLI-${String(input.sequence).padStart(8, "0")}`,
    name: input.name,
    accountType: "REGISTERED",
    verificationStatus: "VERIFIED",
    maskedEmail: email.endsWith("@anonymized.invalid")
      ? null
      : `cl***${String(input.sequence).slice(-2).padStart(2, "0")}@example.test`,
    maskedPhone: phone ? "+34*****0000" : null,
    postalCode: "15001",
    anonymized: email.endsWith("@anonymized.invalid"),
    active,
    createdAt: "2026-01-05T10:00:00.000Z",
    lastLoginAt: active ? now : "2026-09-10T08:00:00.000Z",
    lastPurchaseAt,
    deliveredOrders: input.deliveredOrders,
    cancelledOrders,
    totalSpentCents: input.totalSpentCents,
    averageTicketCents,
  };

  return {
    customer,
    detail: {
      customer: {
        id,
        name: input.name,
        email,
        phone,
        active,
        disabledAt: active ? null : "2026-10-01T09:00:00.000Z",
        createdAt: customer.createdAt,
        lastLoginAt: customer.lastLoginAt,
      },
      metrics: {
        deliveredOrders: input.deliveredOrders,
        cancelledOrders,
        totalSpentCents: input.totalSpentCents,
        averageTicketCents,
        lastPurchaseAt,
      },
      segment: {
        key: input.segment,
        label: segmentLabel(input.segment),
        reason: segmentReason(input.segment, input.deliveredOrders),
      },
      loyalty: {
        program: {
          enabled: true,
          goalOrders: 5,
          rewardType: "DISCOUNT_PERCENT",
          discountPercent: 10,
          freeProductName: "",
          title: "Mordida Club",
          description: "Premio por pedidos entregados.",
        },
        completedOrders: input.deliveredOrders,
        progressOrders: input.deliveredOrders % 5,
        progressPercent: ((input.deliveredOrders % 5) / 5) * 100,
        ordersRemaining: 5 - (input.deliveredOrders % 5),
        earnedRewards: Math.floor(input.deliveredOrders / 5),
        usedRewards: 0,
        availableRewards: Math.floor(input.deliveredOrders / 5),
        rewardReady: input.deliveredOrders >= 5,
        rewardLabel: "10% de descuento",
      },
      cashTrust: {
        status: input.deliveredOrders >= 2 ? "ENABLED" : "PENDING_ACTIVATION",
        cashEnabled: input.deliveredOrders >= 2,
        successfulOrdersCount: input.deliveredOrders,
        requiredSuccessfulOrders: 2,
        ordersRemaining: Math.max(2 - input.deliveredOrders, 0),
        lastIncidentReason: null,
        lastIncidentAt: null,
        unlockedAt: input.deliveredOrders >= 2 ? recentPurchase : null,
      },
      commercialConsents: input.consents
        ? [
            {
              channel: "EMAIL",
              grantedAt: "2026-10-01T10:00:00.000Z",
              withdrawnAt: null,
              consentVersion: "2026-10",
              source: "ACCOUNT",
              withdrawalSource: null,
              updatedAt: "2026-10-01T10:00:00.000Z",
            },
            {
              channel: "SMS",
              grantedAt: "2026-09-01T10:00:00.000Z",
              withdrawnAt: "2026-10-15T10:00:00.000Z",
              consentVersion: "2026-10",
              source: "REGISTRATION",
              withdrawalSource: "ACCOUNT",
              updatedAt: "2026-10-15T10:00:00.000Z",
            },
          ]
        : [],
      orders: input.deliveredOrders
        ? [
            {
              id: `order-${input.sequence}`,
              orderNumber: `MT-20261020-${String(input.sequence).padStart(4, "0")}`,
              status: "DELIVERED",
              deliveryMethod: "PICKUP",
              paymentMethod: "CARD",
              subtotalCents: averageTicketCents,
              discountCents: 0,
              deliveryFeeCents: 0,
              taxCents: 0,
              totalCents: averageTicketCents,
              currency: "EUR",
              createdAt: lastPurchaseAt ?? recentPurchase,
              updatedAt: lastPurchaseAt ?? recentPurchase,
            },
          ]
        : [],
      pagination: {
        page: 1,
        pageSize: 5,
        total: input.deliveredOrders + cancelledOrders,
        totalPages: Math.max(
          1,
          Math.ceil((input.deliveredOrders + cancelledOrders) / 5),
        ),
      },
    },
  };
}

function customerId(sequence: number) {
  return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function segmentLabel(segment: AdminCustomerSegmentKey) {
  return {
    NEW: "Nuevo",
    DEVELOPING: "En desarrollo",
    ACTIVE: "Activo",
    FREQUENT: "Frecuente",
    INACTIVE: "Inactivo",
  }[segment];
}

function segmentReason(
  segment: AdminCustomerSegmentKey,
  deliveredOrders: number,
) {
  if (segment === "NEW") return "No tiene pedidos entregados.";
  if (segment === "INACTIVE") return "Su ultima compra supera 60 dias.";
  if (segment === "FREQUENT") {
    return "Tiene al menos 5 pedidos entregados en los ultimos 90 dias.";
  }
  if (segment === "DEVELOPING") {
    return `Tiene ${deliveredOrders} pedidos entregados y sigue en desarrollo.`;
  }
  return "Tiene compras dentro de los ultimos 60 dias.";
}
