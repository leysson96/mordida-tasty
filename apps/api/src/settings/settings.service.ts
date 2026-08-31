import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { AppEnv } from "../config/env";
import { PrismaService } from "../prisma/prisma.service";

export interface TimeRange {
  open: string;
  close: string;
}

export interface OpeningHours {
  timezone: string;
  weekly: Record<string, TimeRange[]>;
}

export interface SiteContent {
  name: string;
  initials: string;
  tagline: string;
  heroTitle: string;
  heroText: string;
  heroImage: string;
  featuredProductSlug: string;
  featuredProductName: string;
  menuIntroText: string;
  fontFamily: string;
  instagramUrl: string;
  whatsappPhone: string;
}

export interface OrdersPause {
  paused: boolean;
  reason: string;
}

export interface PublicSpecialClosure {
  startsAt: Date;
  endsAt: Date;
  reason: string;
}

export interface ServiceStatus {
  openNow: boolean;
  reason?: string;
  pause: OrdersPause;
  activeClosure?: PublicSpecialClosure;
}

export interface SpecialClosureInput {
  startsAt: string | Date;
  endsAt: string | Date;
  reason: string;
  active?: boolean;
}

const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
const weekdaySet = new Set<string>(weekdays);
const publicClosureSelect = {
  id: true,
  startsAt: true,
  endsAt: true,
  reason: true,
  active: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.SpecialClosureSelect;

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<AppEnv, true>,
  ) {}

  async getTaxRate() {
    const setting = await this.prisma.setting.findUnique({
      where: { key: "tax_rate" },
    });
    return Number(setting?.value ?? 0.1);
  }

  async setTaxRate(taxRate: number) {
    if (taxRate < 0 || taxRate > 1) {
      throw new BadRequestException("Tax rate must be between 0 and 1.");
    }

    return this.prisma.setting.upsert({
      where: { key: "tax_rate" },
      update: { value: taxRate },
      create: { key: "tax_rate", value: taxRate },
    });
  }

  async getDeliveryFeeCents() {
    const setting = await this.prisma.setting.findUnique({
      where: { key: "delivery_fee_cents" },
    });
    return Number(setting?.value ?? 0);
  }

  async setDeliveryFeeCents(deliveryFeeCents: number) {
    if (!Number.isInteger(deliveryFeeCents) || deliveryFeeCents < 0) {
      throw new BadRequestException(
        "Delivery fee must be an integer greater than or equal to 0.",
      );
    }

    return this.prisma.setting.upsert({
      where: { key: "delivery_fee_cents" },
      update: { value: deliveryFeeCents },
      create: { key: "delivery_fee_cents", value: deliveryFeeCents },
    });
  }

  async getOpeningHours() {
    const setting = await this.prisma.setting.findUnique({
      where: { key: "opening_hours" },
    });

    return this.normalizeOpeningHours(
      setting?.value ?? this.defaultOpeningHours(),
    );
  }

  async getSiteContent() {
    const setting = await this.prisma.setting.findUnique({
      where: { key: "site_content" },
    });

    return this.normalizeSiteContent(setting?.value);
  }

  async setSiteContent(value: Partial<SiteContent>) {
    const current = await this.getSiteContent();
    const next = this.normalizeSiteContent({ ...current, ...value });

    return this.prisma.setting
      .upsert({
        where: { key: "site_content" },
        update: { value: next as unknown as Prisma.InputJsonValue },
        create: {
          key: "site_content",
          value: next as unknown as Prisma.InputJsonValue,
        },
      })
      .then(() => next);
  }

  async setOpeningHours(value: OpeningHours) {
    const normalized = this.normalizeOpeningHours(value);
    return this.prisma.setting.upsert({
      where: { key: "opening_hours" },
      update: { value: normalized as unknown as Prisma.InputJsonValue },
      create: {
        key: "opening_hours",
        value: normalized as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async getOrdersPause(): Promise<OrdersPause> {
    const [pausedSetting, reasonSetting] = await Promise.all([
      this.prisma.setting.findUnique({ where: { key: "orders_paused" } }),
      this.prisma.setting.findUnique({
        where: { key: "orders_pause_reason" },
      }),
    ]);
    const reason = cleanText(
      typeof reasonSetting?.value === "string" ? reasonSetting.value : "",
      "",
    );

    return {
      paused: Boolean(pausedSetting?.value ?? false),
      reason,
    };
  }

  async setOrdersPause(value: OrdersPause) {
    const reason = cleanText(value.reason, "");
    const pause = {
      paused: Boolean(value.paused),
      reason: value.paused ? reason : "",
    };

    await this.prisma.$transaction([
      this.prisma.setting.upsert({
        where: { key: "orders_paused" },
        update: { value: pause.paused },
        create: { key: "orders_paused", value: pause.paused },
      }),
      this.prisma.setting.upsert({
        where: { key: "orders_pause_reason" },
        update: { value: pause.reason },
        create: { key: "orders_pause_reason", value: pause.reason },
      }),
    ]);

    return pause;
  }

  listSpecialClosures() {
    return this.prisma.specialClosure.findMany({
      orderBy: [{ active: "desc" }, { startsAt: "desc" }],
      take: 80,
      select: publicClosureSelect,
    });
  }

  createSpecialClosure(value: SpecialClosureInput, actorId?: string) {
    const closure = this.normalizeSpecialClosure(value);
    return this.prisma.specialClosure.create({
      data: {
        ...closure,
        active: value.active ?? true,
        createdById: actorId,
      },
      select: publicClosureSelect,
    });
  }

  async updateSpecialClosure(id: string, value: Partial<SpecialClosureInput>) {
    const current = await this.prisma.specialClosure.findUnique({
      where: { id },
      select: publicClosureSelect,
    });

    if (!current) {
      throw new BadRequestException("Special closure not found.");
    }

    const closure = this.normalizeSpecialClosure({
      startsAt: value.startsAt ?? current.startsAt,
      endsAt: value.endsAt ?? current.endsAt,
      reason: value.reason ?? current.reason,
      active: value.active ?? current.active,
    });

    return this.prisma.specialClosure.update({
      where: { id },
      data: {
        ...closure,
        active: value.active ?? current.active,
      },
      select: publicClosureSelect,
    });
  }

  async deactivateSpecialClosure(id: string) {
    const current = await this.prisma.specialClosure.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!current) {
      throw new BadRequestException("Special closure not found.");
    }

    return this.prisma.specialClosure.update({
      where: { id },
      data: { active: false },
      select: publicClosureSelect,
    });
  }

  async getServiceStatus(date = new Date()): Promise<ServiceStatus> {
    const [weeklyOpen, pause, activeClosure] = await Promise.all([
      this.isOpenByWeeklyHours(date),
      this.getOrdersPause(),
      this.activeSpecialClosure(date),
    ]);

    if (pause.paused) {
      return {
        openNow: false,
        reason: pause.reason || "Pedidos pausados temporalmente.",
        pause,
      };
    }

    if (activeClosure) {
      return {
        openNow: false,
        reason: activeClosure.reason,
        pause,
        activeClosure: {
          startsAt: activeClosure.startsAt,
          endsAt: activeClosure.endsAt,
          reason: activeClosure.reason,
        },
      };
    }

    if (!weeklyOpen) {
      return {
        openNow: false,
        reason: "Fuera de horario de pedidos.",
        pause,
      };
    }

    return {
      openNow: true,
      pause,
    };
  }

  async isOpenNow(date = new Date()) {
    return (await this.getServiceStatus(date)).openNow;
  }

  private async isOpenByWeeklyHours(date = new Date()) {
    const openingHours = await this.getOpeningHours();
    const timezone =
      openingHours.timezone ||
      this.configService.get("APP_TIMEZONE", { infer: true });
    const weekday = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: timezone,
    })
      .format(date)
      .toLowerCase();
    const previousWeekday = this.previousWeekday(weekday);
    const currentMinutes = this.minutesInTimezone(date, timezone);
    const ranges = openingHours.weekly[weekday] ?? [];
    const previousRanges = openingHours.weekly[previousWeekday] ?? [];

    return (
      ranges.some((range) =>
        this.isInsideRangeOnOpeningDay(currentMinutes, range),
      ) ||
      previousRanges.some((range) =>
        this.isInsideOvernightCarryover(currentMinutes, range),
      )
    );
  }

  private activeSpecialClosure(date: Date) {
    return this.prisma.specialClosure.findFirst({
      where: {
        active: true,
        startsAt: { lte: date },
        endsAt: { gt: date },
      },
      orderBy: { startsAt: "asc" },
      select: publicClosureSelect,
    });
  }

  private defaultOpeningHours(): OpeningHours {
    const timezone = this.configService.get("APP_TIMEZONE", { infer: true });
    return {
      timezone,
      weekly: {
        monday: [{ open: "12:00", close: "23:00" }],
        tuesday: [{ open: "12:00", close: "23:00" }],
        wednesday: [{ open: "12:00", close: "23:00" }],
        thursday: [{ open: "12:00", close: "23:00" }],
        friday: [{ open: "12:00", close: "23:30" }],
        saturday: [{ open: "12:00", close: "23:30" }],
        sunday: [{ open: "12:00", close: "23:00" }],
      },
    };
  }

  private normalizeOpeningHours(value: unknown): OpeningHours {
    const defaults = this.defaultOpeningHours();
    const source = isRecord(value) ? value : defaults;
    const timezone = cleanText(source.timezone, defaults.timezone);
    this.assertValidTimezone(timezone);

    const weeklySource = isRecord(source.weekly)
      ? source.weekly
      : defaults.weekly;
    for (const day of Object.keys(weeklySource)) {
      if (!weekdaySet.has(day)) {
        throw new BadRequestException(`Invalid weekday: ${day}`);
      }
    }

    return {
      timezone,
      weekly: weekdays.reduce<Record<string, TimeRange[]>>((acc, day) => {
        const ranges = weeklySource[day];
        if (ranges === undefined) {
          acc[day] = [];
          return acc;
        }

        if (!Array.isArray(ranges)) {
          throw new BadRequestException(
            `Opening ranges for ${day} must be an array.`,
          );
        }

        acc[day] = ranges.map((range) => this.normalizeTimeRange(day, range));
        return acc;
      }, {}),
    };
  }

  private normalizeTimeRange(day: string, value: unknown): TimeRange {
    if (!isRecord(value)) {
      throw new BadRequestException(`Opening range for ${day} is invalid.`);
    }

    const open = cleanText(value.open, "");
    const close = cleanText(value.close, "");
    this.parseTime(open);
    this.parseTime(close);

    return { open, close };
  }

  private assertValidTimezone(timezone: string) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(
        new Date(),
      );
    } catch {
      throw new BadRequestException(`Invalid timezone: ${timezone}`);
    }
  }

  private defaultSiteContent(): SiteContent {
    return {
      name: "Mordida Tasty",
      initials: "MT",
      tagline: "Smash burgers, entrantes y limonadas listas para hoy.",
      heroTitle: "Smash burgers hechas para pedir otra mordida.",
      heroText:
        "Carne marcada al momento, pan brioche tostado y salsas de la casa. Pide online para recoger o recibir en casa.",
      heroImage: "/images/menu/mordida-smash.png",
      featuredProductSlug: "mordida-smash",
      featuredProductName: "Mordida Smash",
      menuIntroText:
        "Smash jugosa, pollo crujiente y entrantes calientes para pedir sin pensarlo.",
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      instagramUrl: "",
      whatsappPhone: "",
    };
  }

  private normalizeSiteContent(value: unknown): SiteContent {
    const defaults = this.defaultSiteContent();
    const source = isRecord(value) ? value : {};
    const content = {
      name: cleanText(source.name, defaults.name),
      initials: cleanText(source.initials, defaults.initials).slice(0, 8),
      tagline: cleanText(source.tagline, defaults.tagline),
      heroTitle: cleanText(source.heroTitle, defaults.heroTitle),
      heroText: cleanText(source.heroText, defaults.heroText),
      heroImage: this.normalizeImagePath(source.heroImage, defaults.heroImage),
      featuredProductSlug: cleanText(
        source.featuredProductSlug,
        defaults.featuredProductSlug,
      ),
      featuredProductName: cleanText(
        source.featuredProductName,
        defaults.featuredProductName,
      ),
      menuIntroText: cleanText(source.menuIntroText, defaults.menuIntroText),
      fontFamily: cleanText(source.fontFamily, defaults.fontFamily),
      instagramUrl: this.normalizeInstagramUrl(source.instagramUrl),
      whatsappPhone: this.normalizeWhatsAppPhone(source.whatsappPhone),
    };

    if (!/^[\w\s"',.-]+$/.test(content.fontFamily)) {
      throw new BadRequestException(
        "Font family contains unsupported characters.",
      );
    }

    return content;
  }

  private normalizeInstagramUrl(value: unknown) {
    const input = cleanText(value, "");
    if (!input) {
      return "";
    }

    const handle = input.replace(/^@/, "");
    if (/^[a-zA-Z0-9._]{1,30}$/.test(handle)) {
      return `https://www.instagram.com/${handle}`;
    }

    try {
      const parsed = new URL(input);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
      if (
        (parsed.protocol === "http:" || parsed.protocol === "https:") &&
        host === "instagram.com"
      ) {
        return parsed.toString();
      }
    } catch {
      throw new BadRequestException(
        "Instagram debe ser un enlace http(s) o un usuario valido.",
      );
    }

    throw new BadRequestException(
      "Instagram debe ser un enlace http(s) o un usuario valido.",
    );
  }

  private normalizeWhatsAppPhone(value: unknown) {
    const input = cleanText(value, "");
    if (!input) {
      return "";
    }

    let phoneSource = input;
    try {
      const parsed = new URL(input);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, "");

      if (host === "wa.me") {
        phoneSource = parsed.pathname;
      } else if (host.endsWith("whatsapp.com")) {
        phoneSource = parsed.searchParams.get("phone") ?? "";
      } else {
        throw new BadRequestException(
          "WhatsApp debe ser un numero con prefijo internacional o un enlace de WhatsApp valido.",
        );
      }
    } catch (error) {
      if (input.startsWith("http://") || input.startsWith("https://")) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          "WhatsApp debe ser un numero con prefijo internacional o un enlace de WhatsApp valido.",
        );
      }
    }

    const digits = phoneSource.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 15) {
      throw new BadRequestException(
        "WhatsApp debe incluir prefijo internacional, por ejemplo +34600111222.",
      );
    }

    return `+${digits}`;
  }

  private normalizeImagePath(value: unknown, fallback: string) {
    const imageUrl = cleanText(value, fallback);

    if (imageUrl.startsWith("/images/") || imageUrl.startsWith("/uploads/")) {
      return imageUrl;
    }

    try {
      const parsed = new URL(imageUrl);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.toString();
      }
    } catch {
      throw new BadRequestException(
        "Image must be a local path or an http(s) URL.",
      );
    }

    throw new BadRequestException(
      "Image must be a local path or an http(s) URL.",
    );
  }

  private normalizeSpecialClosure(value: SpecialClosureInput) {
    const startsAt = normalizeDate(value.startsAt, "startsAt");
    const endsAt = normalizeDate(value.endsAt, "endsAt");
    const reason = cleanText(value.reason, "");

    if (endsAt <= startsAt) {
      throw new BadRequestException(
        "La fecha final del cierre debe ser posterior a la inicial.",
      );
    }

    if (!reason) {
      throw new BadRequestException("El motivo del cierre es obligatorio.");
    }

    return {
      startsAt,
      endsAt,
      reason,
    };
  }

  private minutesInTimezone(date: Date, timezone: string) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timezone,
    }).formatToParts(date);

    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
    const minute = Number(
      parts.find((part) => part.type === "minute")?.value ?? 0,
    );
    return hour * 60 + minute;
  }

  private previousWeekday(day: string) {
    const index = weekdays.findIndex((weekday) => weekday === day);
    if (index === -1) {
      throw new BadRequestException(`Invalid weekday: ${day}`);
    }

    return weekdays[(index + weekdays.length - 1) % weekdays.length];
  }

  private isInsideRangeOnOpeningDay(currentMinutes: number, range: TimeRange) {
    const open = this.parseTime(range.open);
    const close = this.parseTime(range.close);

    if (open <= close) {
      return currentMinutes >= open && currentMinutes <= close;
    }

    return currentMinutes >= open;
  }

  private isInsideOvernightCarryover(currentMinutes: number, range: TimeRange) {
    const open = this.parseTime(range.open);
    const close = this.parseTime(range.close);

    return open > close && currentMinutes <= close;
  }

  private parseTime(value: string) {
    if (!/^\d{2}:\d{2}$/.test(value)) {
      throw new BadRequestException(`Invalid time value: ${value}`);
    }

    const [hour, minute] = value.split(":").map(Number);
    if (
      Number.isNaN(hour) ||
      Number.isNaN(minute) ||
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      throw new BadRequestException(`Invalid time value: ${value}`);
    }
    return hour * 60 + minute;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function normalizeDate(value: string | Date, field: string) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`Invalid date value: ${field}`);
  }

  return date;
}
