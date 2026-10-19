import { expect, test, type Page } from "@playwright/test";
import { mockMordidaApi } from "./mordida-fixtures";

const gaMeasurementId = "G-E2ETEST123";
const googleAdsId = "AW-123456789";

test("configures GA4 and Google Ads with one Google tag after consent", async ({
  page,
}) => {
  await mockMordidaApi(page, { cookieConsent: "analytics" });
  await page.route("https://www.googletagmanager.com/gtag/js**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "",
    }),
  );

  const response = await page.goto("/");
  const contentSecurityPolicy =
    response?.headers()["content-security-policy"] ?? "";

  expect(contentSecurityPolicy).toContain(
    "https://region1.analytics.google.com",
  );
  expect(contentSecurityPolicy).toContain("https://stats.g.doubleclick.net");
  expect(contentSecurityPolicy).toContain("https://ad.doubleclick.net");
  expect(contentSecurityPolicy).toContain("https://www.google.com");
  expect(contentSecurityPolicy).toContain("https://www.google.es");

  await expect(
    page.locator(`script[src*="gtag/js?id=${gaMeasurementId}"]`),
  ).toHaveCount(1);

  await expect
    .poll(() => googleTagCalls(page))
    .toEqual(
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
});

test("does not load Google tracking without analytics consent", async ({
  page,
}) => {
  await mockMordidaApi(page, { cookieConsent: "technical" });

  await page.goto("/");

  await expect(page.locator('script[src*="googletagmanager.com"]')).toHaveCount(
    0,
  );
  expect(await googleTagCalls(page)).toEqual([]);
});

test("shows the approved cookie consent label to new visitors", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await page.addInitScript(() => {
    window.localStorage.removeItem("mordida_cookie_consent");
  });

  await page.goto("/");

  await expect(
    page.getByRole("button", { name: "Aceptar cookies", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Aceptar medicion", exact: true }),
  ).toHaveCount(0);
});

async function googleTagCalls(page: Page) {
  return page.evaluate(() =>
    (window.dataLayer ?? [])
      .filter((entry): entry is IArguments =>
        Object.prototype.toString.call(entry) === "[object Arguments]",
      )
      .map((entry) => Array.from(entry)),
  );
}
