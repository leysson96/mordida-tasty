import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { SettingsService } from "./settings.service";

const deliveryZoneSelect = {
  id: true,
  name: true,
  postalCodes: true,
  deliveryFeeCents: true,
  minimumOrderCents: true,
  active: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.DeliveryZoneSelect;

type DeliveryZoneRecord = Prisma.DeliveryZoneGetPayload<{
  select: typeof deliveryZoneSelect;
}>;

export type DeliveryZone = Omit<DeliveryZoneRecord, "postalCodes"> & {
  postalCodes: string[];
};

export interface DeliveryQuote {
  available: boolean;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  zone?: DeliveryZone;
  reason?: string;
}

export interface DeliveryZoneInput {
  name: string;
  postalCodes: string[];
  deliveryFeeCents: number;
  minimumOrderCents: number;
  active?: boolean;
  sortOrder?: number;
}

@Injectable()
export class DeliveryZonesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  async listAdminZones() {
    const zones = await this.prisma.deliveryZone.findMany({
      orderBy: [{ active: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: deliveryZoneSelect,
    });

    return zones.map((zone) => this.toDeliveryZone(zone));
  }

  async listPublicZones() {
    const zones = await this.prisma.deliveryZone.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: deliveryZoneSelect,
    });

    return zones.map((zone) => this.toDeliveryZone(zone));
  }

  async quoteDelivery(
    postalCode: string | undefined,
    subtotalCents: number,
  ): Promise<DeliveryQuote> {
    if (!Number.isInteger(subtotalCents) || subtotalCents < 0) {
      throw new BadRequestException("Subtotal must be a positive integer.");
    }

    const activeZones = await this.listPublicZones();
    const fallbackFeeCents = await this.settingsService.getDeliveryFeeCents();

    if (activeZones.length === 0) {
      return {
        available: true,
        deliveryFeeCents: fallbackFeeCents,
        minimumOrderCents: 0,
      };
    }

    const cleanPostalCode = normalizePostalCode(postalCode);
    const zone = activeZones.find((item) =>
      item.postalCodes.some((rule) => postalRuleMatches(rule, cleanPostalCode)),
    );

    if (!zone) {
      return {
        available: false,
        deliveryFeeCents: 0,
        minimumOrderCents: 0,
        reason: "No repartimos en ese codigo postal.",
      };
    }

    if (subtotalCents < zone.minimumOrderCents) {
      return {
        available: false,
        deliveryFeeCents: zone.deliveryFeeCents,
        minimumOrderCents: zone.minimumOrderCents,
        zone,
        reason: `Pedido minimo para ${zone.name}: ${formatCents(zone.minimumOrderCents)}.`,
      };
    }

    return {
      available: true,
      deliveryFeeCents: zone.deliveryFeeCents,
      minimumOrderCents: zone.minimumOrderCents,
      zone,
    };
  }

  async createZone(input: DeliveryZoneInput) {
    const data = this.normalizeZoneInput(input);
    const zone = await this.prisma.deliveryZone.create({
      data: {
        ...data,
        postalCodes: data.postalCodes,
        active: input.active ?? true,
        sortOrder: input.sortOrder ?? 0,
      },
      select: deliveryZoneSelect,
    });

    return this.toDeliveryZone(zone);
  }

  async updateZone(id: string, input: Partial<DeliveryZoneInput>) {
    const current = await this.findZoneOrThrow(id);
    const data: Prisma.DeliveryZoneUpdateInput = {};

    if (input.name !== undefined) {
      data.name = cleanText(input.name, "Zone name");
    }

    if (input.postalCodes !== undefined) {
      data.postalCodes = normalizePostalRules(input.postalCodes);
    }

    if (input.deliveryFeeCents !== undefined) {
      data.deliveryFeeCents = this.normalizeMoney(input.deliveryFeeCents);
    }

    if (input.minimumOrderCents !== undefined) {
      data.minimumOrderCents = this.normalizeMoney(input.minimumOrderCents);
    }

    if (input.active !== undefined) {
      data.active = Boolean(input.active);
    }

    if (input.sortOrder !== undefined) {
      data.sortOrder = this.normalizeSortOrder(input.sortOrder);
    }

    const updated = await this.prisma.deliveryZone.update({
      where: { id: current.id },
      data,
      select: deliveryZoneSelect,
    });

    return this.toDeliveryZone(updated);
  }

  async deactivateZone(id: string) {
    await this.findZoneOrThrow(id);
    const zone = await this.prisma.deliveryZone.update({
      where: { id },
      data: { active: false },
      select: deliveryZoneSelect,
    });

    return this.toDeliveryZone(zone);
  }

  private async findZoneOrThrow(id: string) {
    const zone = await this.prisma.deliveryZone.findUnique({
      where: { id },
      select: deliveryZoneSelect,
    });

    if (!zone) {
      throw new NotFoundException("Delivery zone not found.");
    }

    return zone;
  }

  private normalizeZoneInput(input: DeliveryZoneInput) {
    return {
      name: cleanText(input.name, "Zone name"),
      postalCodes: normalizePostalRules(input.postalCodes),
      deliveryFeeCents: this.normalizeMoney(input.deliveryFeeCents),
      minimumOrderCents: this.normalizeMoney(input.minimumOrderCents),
    };
  }

  private normalizeMoney(value: number) {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException("Amount must be an integer >= 0.");
    }

    return value;
  }

  private normalizeSortOrder(value: number) {
    if (!Number.isInteger(value) || value < 0) {
      throw new BadRequestException("Sort order must be an integer >= 0.");
    }

    return value;
  }

  private toDeliveryZone(zone: DeliveryZoneRecord): DeliveryZone {
    return {
      ...zone,
      postalCodes: normalizePostalRules(readPostalRules(zone.postalCodes)),
    };
  }
}

function normalizePostalCode(value: string | undefined) {
  const postalCode = value?.trim().toUpperCase().replace(/[\s-]/g, "") ?? "";

  if (!/^[A-Z0-9]{2,12}$/.test(postalCode)) {
    throw new BadRequestException("Codigo postal no valido.");
  }

  return postalCode;
}

function normalizePostalRules(values: string[]) {
  const rules = values.map(normalizePostalRule);
  const unique = [...new Set(rules)];

  if (unique.length === 0) {
    throw new BadRequestException("At least one postal code is required.");
  }

  return unique;
}

function normalizePostalRule(value: string) {
  const rule = value.trim().toUpperCase().replace(/[\s-]/g, "");

  if (!/^[A-Z0-9]{2,12}\*?$/.test(rule)) {
    throw new BadRequestException("Postal code rule is invalid.");
  }

  return rule;
}

function postalRuleMatches(rule: string, postalCode: string) {
  if (rule.endsWith("*")) {
    return postalCode.startsWith(rule.slice(0, -1));
  }

  return postalCode === rule;
}

function readPostalRules(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function cleanText(value: string, field: string) {
  const clean = value.trim();
  if (!clean) {
    throw new BadRequestException(`${field} is required.`);
  }

  return clean;
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
