import type { OpeningHours } from "./opening-hours";

export type Role = "CLIENTE" | "ADMIN" | "KITCHEN";

export type DeliveryMethod = "DELIVERY" | "PICKUP";

export type OrderPaymentMethod = "CARD" | "CASH";

export type OrderStatus =
  | "CREATED"
  | "PENDING_PAYMENT"
  | "PAID"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED"
  | "PAYMENT_FAILED"
  | "EXPIRED";

export interface Product {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  imageUrl?: string | null;
  active: boolean;
  available: boolean;
  sortOrder: number;
  optionGroups?: ProductOptionGroup[];
}

export interface ProductOptionChoice {
  id: string;
  groupId: string;
  name: string;
  priceCents: number;
  active: boolean;
  sortOrder: number;
}

export interface ProductOptionGroup {
  id: string;
  productId: string;
  name: string;
  required: boolean;
  minChoices: number;
  maxChoices: number;
  active: boolean;
  sortOrder: number;
  choices: ProductOptionChoice[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  active: boolean;
  products?: Product[];
  _count?: {
    products: number;
  };
}

export interface AdminProduct extends Product {
  category: Category;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  slug: string;
  priceCents: number;
  imageUrl?: string | null;
  quantity: number;
  options: CartItemOption[];
}

export interface CartItemOption {
  groupId: string;
  groupName: string;
  choiceId: string;
  choiceName: string;
  priceCents: number;
}

export interface OrderItem {
  id?: string;
  productName: string;
  quantity: number;
  unitPriceCents?: number;
  lineTotalCents: number;
  removedAt?: string | null;
  removedReason?: string | null;
  refundedCents?: number;
  stripeRefundId?: string | null;
  options?: Array<{
    groupName: string;
    choiceName: string;
    priceCents: number;
  }>;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  trackingToken?: string;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  paymentMethod?: OrderPaymentMethod;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  deliveryName?: string | null;
  deliveryPhone?: string | null;
  deliveryStreet?: string | null;
  deliveryCity?: string | null;
  deliveryPostalCode?: string | null;
  deliveryNotes?: string | null;
  subtotalCents?: number;
  deliveryFeeCents?: number;
  taxCents?: number;
  cashTenderedCents?: number | null;
  cashChangeCents?: number | null;
  totalCents: number;
  createdAt: string;
  updatedAt?: string;
  items: OrderItem[];
  statusHistory?: Array<{
    toStatus: OrderStatus;
    note?: string | null;
    createdAt: string;
  }>;
}

export interface Address {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
  notes?: string | null;
  isDefault: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: Role;
  active: boolean;
  disabledAt?: string | null;
  emailVerifiedAt?: string | null;
  twoFactorEnabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StaffUser extends User {
  role: "ADMIN" | "KITCHEN";
  active: boolean;
  disabledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrdersPause {
  paused: boolean;
  reason: string;
}

export interface PublicSpecialClosure {
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface ServiceStatus {
  openNow: boolean;
  reason?: string;
  pause: OrdersPause;
  activeClosure?: PublicSpecialClosure;
}

export interface SpecialClosure extends PublicSpecialClosure {
  id: string;
  active: boolean;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryZone {
  id: string;
  name: string;
  postalCodes: string[];
  deliveryFeeCents: number;
  minimumOrderCents: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryQuote {
  available: boolean;
  deliveryFeeCents: number;
  minimumOrderCents: number;
  zone?: DeliveryZone;
  reason?: string;
}

export interface PublicSettings {
  taxRate: number;
  deliveryFeeCents: number;
  deliveryZones: DeliveryZone[];
  openingHours: OpeningHours;
  openNow: boolean;
  serviceStatus: ServiceStatus;
  siteContent: SiteContent;
  legalVersion: string;
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

export interface UploadedImage {
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}
