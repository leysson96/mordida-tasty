import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mockMordidaApi } from "./mordida-fixtures";

test("home renders menu on desktop and mobile", async ({ page }, testInfo) => {
  await mockMordidaApi(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Smash burgers hechas para pedir otra mordida/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Elige tu mordida" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mordida Smash" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Como llegar/i })).toBeVisible();

  await expectHealthyPage(page);
  await capture(page, testInfo, "home");
});

test("customer registration and login flow works", async ({ page }, testInfo) => {
  await mockMordidaApi(page);
  await page.goto("/auth/registro");

  await page.getByLabel("Nombre").fill("Cliente Mordida");
  await page.getByLabel("Email").fill("cliente@mordida.test");
  await page.getByLabel("Telefono").fill("+34600111222");
  await page.locator('input[name="password"]').fill("SuperSegura123!");
  await page.getByLabel(/Acepto la/i).check();
  await page.getByRole("button", { name: /Crear/i }).click();

  await expect(
    page.getByText("Cuenta creada. Revisa tu email para verificarla."),
  ).toBeVisible();

  await page.goto("/auth/login");
  await page.getByLabel("Email").fill("cliente@mordida.test");
  await page.locator('input[name="password"]').fill("SuperSegura123!");
  await page.getByRole("button", { name: /Entrar/i }).click();

  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole("heading", { name: "Cliente Mordida" })).toBeVisible();
  await expect(page.getByText("Casa")).toBeVisible();

  await expectHealthyPage(page);
  await capture(page, testInfo, "customer-account");
});

test("cash delivery checkout opens tracking", async ({ page }, testInfo) => {
  const apiState = await mockMordidaApi(page);
  await openCheckoutWithCart(page);

  await expect(page.getByText("1 x Mordida Smash")).toBeVisible();
  await page.getByRole("button", { name: /Envio/i }).click();
  await page.getByRole("button", { name: /Efectivo/i }).click();
  await page.getByLabel("Paga con").fill("20");
  await page.getByLabel(/Acepto la/i).check();
  await page.getByRole("button", { name: /Confirmar pedido/i }).click();

  await expect(page).toHaveURL(/\/seguimiento\/MT-20260911-0001\?t=track-token-e2e/);
  await expect(page.getByRole("heading", { name: "Pagado" })).toBeVisible();
  await expect(page.getByText("Portal en obra")).toBeVisible();
  expect(apiState.createdOrders).toBe(1);

  await expectHealthyPage(page);
  await capture(page, testInfo, "checkout-cash-tracking");
});

test("card checkout redirects to mocked Stripe", async ({ page }, testInfo) => {
  const apiState = await mockMordidaApi(page);
  await openCheckoutWithCart(page);

  await page.getByLabel(/Acepto la/i).check();
  await page.getByRole("button", { name: /^Pagar$/i }).click();

  await expect(page).toHaveURL(/checkout\.stripe\.test\/pay\/cs_test_mock/);
  await expect(page.getByRole("heading", { name: "Stripe Checkout mock" })).toBeVisible();
  expect(apiState.createdOrders).toBe(1);
  expect(apiState.checkoutRequests).toBe(1);

  await capture(page, testInfo, "checkout-stripe-mock");
});

test("admin login with 2FA setup reaches dashboard", async ({ page }, testInfo) => {
  await mockMordidaApi(page);
  await page.goto("/admin/login");

  await page.getByLabel("Email").fill("admin@mordida.test");
  await page.locator('input[name="password"]').fill("SuperSegura123!");
  await page.getByRole("button", { name: /Entrar/i }).click();

  await expect(page).toHaveURL(/\/admin\/2fa$/);
  await expect(page.getByRole("heading", { name: "Activa 2FA" })).toBeVisible();
  await expect(page.getByText("JBSWY3DPEHPK3PXP")).toBeVisible();

  await page.getByLabel("Codigo de la app").fill("123456");
  await page.getByRole("button", { name: /Activar 2FA/i }).click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Pedidos de hoy" })).toBeVisible();

  await expectHealthyPage(page);
  await capture(page, testInfo, "admin-dashboard");
});

test("admin image upload and reports smoke", async ({ page }, testInfo) => {
  const apiState = await mockMordidaApi(page);

  await page.goto("/admin/menu");
  await page.getByRole("button", { name: /Portada/i }).click();
  await page.getByLabel("Foto portada").setInputFiles({
    name: "hero.png",
    mimeType: "image/png",
    buffer: tinyPng(),
  });
  await page.getByRole("button", { name: /Guardar portada/i }).click();

  await expect(page.getByText("Portada guardada.")).toBeVisible();
  expect(apiState.uploadedHeroSaved).toBe(true);

  await page.goto("/admin/reportes");
  await expect(page.getByRole("heading", { name: "Reportes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Historial de pedidos" })).toBeVisible();
  await expect(page.getByText("MT-20260911-0001")).toBeVisible();
  await page.getByRole("button", { name: /MT-20260911-0001/i }).click();
  await expect(page.getByText("Portal en obra")).toBeVisible();

  await expectHealthyPage(page);
  await capture(page, testInfo, "admin-reports");
});

async function openCheckoutWithCart(page: Page) {
  await page.goto("/");

  const productCard = page.locator(".product-card", {
    hasText: "Mordida Smash",
  });
  await productCard.getByTitle("Anadir al carrito").click();
  await expect(
    page.getByRole("link", { name: /Carrito con 1 productos/i }),
  ).toBeVisible();

  await page.getByRole("link", { name: /Carrito con 1 productos/i }).click();
  await expect(page.getByRole("heading", { name: "Tu pedido" })).toBeVisible();
  await page.getByRole("link", { name: "Continuar" }).click();
  await expect(
    page.getByRole("heading", { name: "Datos del pedido" }),
  ).toBeVisible();
}

async function expectHealthyPage(page: Page) {
  const bodyText = await page.locator("body").innerText();
  expect(bodyText.trim().length).toBeGreaterThan(30);

  const brokenImages = await page.locator("img").evaluateAll(async (images) => {
    await Promise.all(
      images.map(
        (image) =>
          image.complete ||
          new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
      ),
    );

    return images
      .filter((image) => image.naturalWidth === 0)
      .map((image) => image.getAttribute("alt") ?? image.currentSrc);
  });
  expect(brokenImages).toEqual([]);

  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(horizontalOverflow).toBeLessThanOrEqual(8);
}

async function capture(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
  });
}

function tinyPng() {
  return Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
    "base64",
  );
}
