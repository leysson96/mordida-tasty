import { expect, test } from "@playwright/test";
import { mockMordidaApi } from "./mordida-fixtures";

test("inactive and expired promotions stay hidden while menu works", async ({
  page,
}) => {
  for (const scenario of ["disabled", "expired"] as const) {
    await mockMordidaApi(page, { promotions: scenario });
    await page.goto("/");

    await expect(
      page.getByRole("region", { name: "Promociones activas" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("heading", { name: "Mordida Smash", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("10,71 €")).toHaveCount(0);
  }
});

test("promotion outside valid weekday is visible as notice without discounted price", async ({
  page,
}) => {
  await mockMordidaApi(page, { promotions: "outsideWeekday" });
  await page.goto("/");

  const promoRegion = page.getByRole("region", { name: "Promociones activas" });
  const productCard = page.locator(".product-card", {
    hasText: "Mordida Smash",
  });

  await expect(promoRegion).toBeVisible();
  await expect(promoRegion.getByText("Valido domingo")).toBeVisible();
  await expect(productCard.getByText("11,90 €")).toBeVisible();
  await expect(productCard.locator(".price-before")).toHaveCount(0);
  await expect(productCard.locator(".price-final")).toHaveCount(0);
});

test("promotion with unavailable product is hidden and product cannot be added", async ({
  page,
}) => {
  await mockMordidaApi(page, { promotions: "unavailable" });
  await page.goto("/");

  const productCard = page.locator(".product-card", {
    hasText: "Mordida Smash",
  });

  await expect(
    page.getByRole("region", { name: "Promociones activas" }),
  ).toHaveCount(0);
  await expect(productCard.getByText("Agotado")).toBeVisible();
  await expect(productCard.getByTitle("Anadir al carrito")).toBeDisabled();
});

test("empty menu shows a stable empty state", async ({ page }) => {
  await mockMordidaApi(page, { promotions: "empty" });
  await page.goto("/");

  await expect(
    page.getByText("La carta todavia no tiene productos disponibles."),
  ).toBeVisible();
  await expect(page.locator(".product-card")).toHaveCount(0);
});
