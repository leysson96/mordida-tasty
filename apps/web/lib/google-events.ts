const purchaseStoragePrefix = "mordida_google_purchase_sent:";
const gaMeasurementIdPattern = /^G-[A-Z0-9]+$/i;
const googleAdsIdPattern = /^AW-\d+$/i;
const googleAdsLabelPattern = /^[A-Z0-9_-]+$/i;
const sentPurchaseTransactionIds = new Set<string>();

export interface GooglePurchaseOrder {
  orderNumber: string;
  paidAt?: string | null;
  totalCents: number;
  discountCents?: number | null;
  items: Array<{
    promotionDiscountCents?: number | null;
  }>;
}

export interface GooglePurchasePayload {
  transaction_id: string;
  currency: "EUR";
  value: number;
  discount: number;
  send_to: string | string[];
}

export function sendGooglePurchase(order: GooglePurchaseOrder) {
  const payload = buildGooglePurchasePayload(order);
  if (!payload || typeof window === "undefined" || !window.gtag) {
    return false;
  }

  if (hasSentPurchase(payload.transaction_id)) {
    return false;
  }

  markPurchaseAsSent(payload.transaction_id);

  try {
    window.gtag("event", "purchase", payload);
    return true;
  } catch {
    unmarkPurchaseAsSent(payload.transaction_id);
    return false;
  }
}

export function buildGooglePurchasePayload(
  order: GooglePurchaseOrder,
): GooglePurchasePayload | null {
  const transactionId = order.orderNumber.trim();
  if (!order.paidAt || !transactionId || !isValidCents(order.totalCents)) {
    return null;
  }

  const destinations = googleDestinations();
  if (destinations.length === 0) {
    return null;
  }

  const loyaltyDiscountCents = validDiscountCents(order.discountCents);
  const promotionDiscountCents = order.items.reduce(
    (total, item) =>
      total + validDiscountCents(item.promotionDiscountCents),
    0,
  );

  return {
    transaction_id: transactionId,
    currency: "EUR",
    value: centsToEuros(order.totalCents),
    discount: centsToEuros(
      loyaltyDiscountCents + promotionDiscountCents,
    ),
    send_to: destinations.length === 1 ? destinations[0] : destinations,
  };
}

function googleDestinations() {
  const measurementId = (
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? ""
  ).trim();
  const googleAdsId = (process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "").trim();
  const googleAdsLabel = (
    process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL ?? ""
  ).trim();
  const destinations: string[] = [];

  if (gaMeasurementIdPattern.test(measurementId)) {
    destinations.push(measurementId.toUpperCase());
  }

  if (
    googleAdsIdPattern.test(googleAdsId) &&
    googleAdsLabelPattern.test(googleAdsLabel)
  ) {
    destinations.push(
      `${googleAdsId.toUpperCase()}/${googleAdsLabel}`,
    );
  }

  return destinations;
}

function hasSentPurchase(transactionId: string) {
  if (sentPurchaseTransactionIds.has(transactionId)) {
    return true;
  }

  try {
    return window.localStorage.getItem(purchaseStorageKey(transactionId)) === "1";
  } catch {
    return false;
  }
}

function markPurchaseAsSent(transactionId: string) {
  sentPurchaseTransactionIds.add(transactionId);
  try {
    window.localStorage.setItem(purchaseStorageKey(transactionId), "1");
  } catch {
    // The in-memory marker still prevents duplicate polling events.
  }
}

function unmarkPurchaseAsSent(transactionId: string) {
  sentPurchaseTransactionIds.delete(transactionId);
  try {
    window.localStorage.removeItem(purchaseStorageKey(transactionId));
  } catch {
    // Nothing else can be restored when browser storage is unavailable.
  }
}

function purchaseStorageKey(transactionId: string) {
  return `${purchaseStoragePrefix}${transactionId}`;
}

function isValidCents(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validDiscountCents(value: number | null | undefined) {
  return value !== undefined && value !== null && isValidCents(value)
    ? value
    : 0;
}

function centsToEuros(value: number) {
  return Number((value / 100).toFixed(2));
}
