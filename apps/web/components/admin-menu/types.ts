import type {
  DiscountScope,
  DiscountWeekday,
  PromotionCampaign,
  PromotionDiscountType,
  SiteContent,
} from "../../lib/types";

export interface AdminSettingsResponse {
  siteContent: SiteContent;
  promotionCampaign: PromotionCampaign;
}

export type MenuAdminSection =
  | "products"
  | "categories"
  | "brand"
  | "promotions";

export const defaultPromotionCampaign: PromotionCampaign = {
  enabled: false,
  badge: "",
  title: "",
  description: "",
  productSlug: "",
  discountId: "",
  imageUrl: "",
  startsOn: "",
  endsOn: "",
  ctaLabel: "Pedir ahora",
};

export type EditableDiscountScope = Extract<
  DiscountScope,
  "PRODUCTS" | "CATEGORY"
>;

export interface AdminDiscountPayload {
  name: string;
  description: string;
  active: boolean;
  type: PromotionDiscountType;
  value: number;
  scope: EditableDiscountScope;
  startsOn: string;
  endsOn: string;
  weekdays: DiscountWeekday[];
  priority: number;
  productIds?: string[];
  categoryId?: string;
}

export interface WeekdayOption {
  value: DiscountWeekday;
  label: string;
}

export const weekdayOptions: WeekdayOption[] = [
  { value: "MON", label: "Lun" },
  { value: "TUE", label: "Mar" },
  { value: "WED", label: "Mie" },
  { value: "THU", label: "Jue" },
  { value: "FRI", label: "Vie" },
  { value: "SAT", label: "Sab" },
  { value: "SUN", label: "Dom" },
];
