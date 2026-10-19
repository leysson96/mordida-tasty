import { expect, test, type Page } from "@playwright/test";
import { mockMordidaApi } from "./mordida-fixtures";

const consentStorageKey = "mordida_cookie_consent";
const gaMeasurementId = "G-E2ETEST123";
const googleAdsId = "AW-123456789";
const googleAdsPurchaseDestination = `${googleAdsId}/PURCHASE_E2E`;
const fullConsent = {
  version: 2 as const,
  analytics: true,
  advertising: true,
  personalization: true,
};
const deniedConsent = {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};

test("starts denied before config and loads one public Google tag", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await clearStoredConsentOnFirstLoad(page);
  await mockGoogleTag(page);

  const response = await page.goto("/");

  await expect(
    page.getByRole("button", { name: "Aceptar cookies", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(`script[src*="gtag/js?id=${gaMeasurementId}"]`),
  ).toHaveCount(1);
  await expect.poll(() => googleTagCalls(page)).toEqual(
    expect.arrayContaining([
      ["config", gaMeasurementId, expect.any(Object)],
      ["config", googleAdsId],
      [
        "event",
        "page_view",
        expect.objectContaining({ send_to: gaMeasurementId }),
      ],
    ]),
  );

  const calls = await googleTagCalls(page);
  const defaultIndex = findCallIndex(calls, "consent", "default");
  const firstConfigIndex = findCallIndex(calls, "config");
  expect(defaultIndex).toBeGreaterThanOrEqual(0);
  expect(defaultIndex).toBeLessThan(firstConfigIndex);
  expect(calls[defaultIndex]?.[2]).toEqual(
    expect.objectContaining(deniedConsent),
  );

  const contentSecurityPolicy =
    response?.headers()["content-security-policy"] ?? "";
  expect(contentSecurityPolicy).toContain("https://www.googletagmanager.com");
  expect(contentSecurityPolicy).toContain(
    "https://region1.analytics.google.com",
  );
  expect(contentSecurityPolicy).toContain("https://stats.g.doubleclick.net");
  expect(contentSecurityPolicy).toContain("https://ad.doubleclick.net");
});

test("keeps every Google consent denied with necessary cookies only", async ({
  page,
  context,
}) => {
  await mockMordidaApi(page);
  await clearStoredConsentOnFirstLoad(page);
  await mockGoogleTag(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Solo necesarias" }).click();

  await expect.poll(() => latestConsentUpdate(page)).toEqual(deniedConsent);
  expect(await storedConsent(page)).toEqual({
    version: 2,
    analytics: false,
    advertising: false,
    personalization: false,
  });
  expect(
    (await context.cookies()).filter((cookie) => cookie.name.startsWith("_ga")),
  ).toHaveLength(0);
});

test("accepts all cookie categories and persists them after reload", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await clearStoredConsentOnFirstLoad(page);
  await mockGoogleTag(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Aceptar cookies" }).click();

  await expect.poll(() => latestConsentUpdate(page)).toEqual({
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
  expect(await storedConsent(page)).toEqual(fullConsent);

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Aceptar cookies", exact: true }),
  ).toHaveCount(0);
  await expect.poll(() => latestConsentUpdate(page)).toEqual({
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
});

test("saves granular analytics and advertising without personalization", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await clearStoredConsentOnFirstLoad(page);
  await mockGoogleTag(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Configurar" }).click();
  const dialog = page.getByRole("dialog", { name: "Preferencias de cookies" });
  await dialog.getByRole("switch", { name: /Anal/ }).click();
  await dialog.getByRole("switch", { name: /Medici/ }).click();
  await dialog
    .getByRole("button", { name: "Guardar preferencias" })
    .click();

  await expect.poll(() => latestConsentUpdate(page)).toEqual({
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "denied",
  });
  expect(await storedConsent(page)).toEqual({
    version: 2,
    analytics: true,
    advertising: true,
    personalization: false,
  });
});

test("keeps legacy analytics consent restricted to analytics", async ({
  page,
}) => {
  await mockMordidaApi(page, { cookieConsent: "analytics" });
  await mockGoogleTag(page);

  await page.goto("/");

  await expect.poll(() => latestConsentUpdate(page)).toEqual({
    analytics_storage: "granted",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
});

test("allows withdrawing a previously granted consent", async ({ page }) => {
  await mockMordidaApi(page, { cookieConsent: fullConsent });
  await mockGoogleTag(page);
  await page.goto("/");

  await expect.poll(() => latestConsentUpdate(page)).toEqual({
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
  await page.getByRole("button", { name: "Configurar cookies" }).click();
  await page
    .getByRole("dialog", { name: "Preferencias de cookies" })
    .getByRole("button", { name: "Solo necesarias" })
    .click();

  await expect.poll(() => latestConsentUpdate(page)).toEqual(deniedConsent);
  expect(await storedConsent(page)).toEqual({
    version: 2,
    analytics: false,
    advertising: false,
    personalization: false,
  });
});

test("does not initialize Google or the cookie banner in admin", async ({
  page,
}) => {
  await mockMordidaApi(page, { cookieConsent: fullConsent });
  await mockGoogleTag(page);

  await page.goto("/admin");

  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Configurar cookies" }),
  ).toHaveCount(0);
  expect(await googleTagCalls(page)).toEqual([]);
});

test("sends one purchase after paidAt without personal data or duplicates", async ({
  page,
}) => {
  const state = await mockMordidaApi(page, {
    cookieConsent: fullConsent,
    trackingPayment: "pendingThenPaid",
  });
  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = ((
      handler: TimerHandler,
      timeout?: number,
      ...args: unknown[]
    ) =>
      nativeSetInterval(
        handler,
        timeout === 10_000 ? 50 : timeout,
        ...args,
      )) as typeof window.setInterval;
  });
  await mockGoogleTag(page);

  await page.goto(
    "/seguimiento/MT-20260911-0001?t=track-token-e2e",
  );

  await expect.poll(() => state.trackingRequests).toBeGreaterThanOrEqual(2);
  await expect.poll(() => purchaseCalls(page)).toHaveLength(1);

  const [purchase] = await purchaseCalls(page);
  expect(purchase?.[2]).toEqual({
    transaction_id: "MT-20260911-0001",
    currency: "EUR",
    value: 14.4,
    discount: 0,
    send_to: [gaMeasurementId, googleAdsPurchaseDestination],
  });
  const serializedPayload = JSON.stringify(purchase?.[2]);
  expect(serializedPayload).not.toContain("cliente@mordida.test");
  expect(serializedPayload).not.toContain("+34600111222");
  expect(serializedPayload).not.toContain("track-token-e2e");
  expect(serializedPayload).not.toContain("order-1");

  const requestsBeforeReload = state.trackingRequests;
  await page.reload();
  await expect
    .poll(() => state.trackingRequests)
    .toBeGreaterThan(requestsBeforeReload);
  await expect.poll(() => purchaseCalls(page)).toHaveLength(0);
});

async function mockGoogleTag(page: Page) {
  await page.route("https://www.googletagmanager.com/gtag/js**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "",
    }),
  );
}

async function clearStoredConsentOnFirstLoad(page: Page) {
  await page.addInitScript((storageKey) => {
    const marker = `${storageKey}_e2e_cleared`;
    if (window.sessionStorage.getItem(marker) === "1") {
      return;
    }
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.setItem(marker, "1");
  }, consentStorageKey);
}

async function googleTagCalls(page: Page): Promise<unknown[][]> {
  return page.evaluate(() =>
    (window.dataLayer ?? [])
      .map((entry) => {
        if (Array.isArray(entry)) {
          return entry;
        }
        if (Object.prototype.toString.call(entry) === "[object Arguments]") {
          return Array.from(entry as IArguments);
        }
        return null;
      })
      .filter((entry): entry is unknown[] => entry !== null),
  );
}

function findCallIndex(calls: unknown[][], command: string, action?: string) {
  return calls.findIndex(
    (call) => call[0] === command && (action === undefined || call[1] === action),
  );
}

async function latestConsentUpdate(page: Page) {
  const updates = (await googleTagCalls(page)).filter(
    (call) => call[0] === "consent" && call[1] === "update",
  );
  return updates.at(-1)?.[2] ?? null;
}

async function purchaseCalls(page: Page) {
  return (await googleTagCalls(page)).filter(
    (call) => call[0] === "event" && call[1] === "purchase",
  );
}

async function storedConsent(page: Page) {
  return page.evaluate((storageKey) => {
    const stored = window.localStorage.getItem(storageKey);
    return stored ? JSON.parse(stored) : null;
  }, consentStorageKey);
}
