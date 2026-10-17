import { expect, test } from "@playwright/test";
import { mockMordidaApi } from "./mordida-fixtures";

test("active promotion appears in menu and keeps discounted price in cart", async ({
  page,
}) => {
  await mockMordidaApi(page, { promotions: true });
  await page.goto("/");

  const promoRegion = page.getByRole("region", { name: "Promociones activas" });

  await expect(promoRegion).toBeVisible();
  await expect(page.getByRole("heading", { name: "Promos activas" })).toBeVisible();
  await expect(
    promoRegion.getByRole("heading", { name: "PROMO TEMPORAL Mordida Smash" }),
  ).toBeVisible();
  await expect(promoRegion.getByText("Valido todos los dias")).toBeVisible();

  const productCard = page.locator(".product-card", {
    hasText: "Mordida Smash",
  });
  await expect(productCard.getByText("11,90 €")).toBeVisible();
  await expect(productCard.getByText("10,71 €")).toBeVisible();

  await productCard.getByTitle("Anadir al carrito").click();
  await page.getByRole("link", { name: /Carrito con 1 productos/i }).click();

  await expect(page.getByRole("heading", { name: "Tu pedido" })).toBeVisible();
  const cartList = page.locator(".cart-list");

  await expect(cartList.getByText("PROMO TEMPORAL")).toBeVisible();
  await expect(cartList.locator(".price-before", { hasText: "11,90 €" })).toBeVisible();
  await expect(cartList.locator(".price-final", { hasText: "10,71 €" })).toBeVisible();
  await expect(page.getByText("Promos aplicadas")).toBeVisible();
  await expect(page.getByText("-1,19 €")).toBeVisible();
});
