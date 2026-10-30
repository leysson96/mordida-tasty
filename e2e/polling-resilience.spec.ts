import { expect, test } from "@playwright/test";
import { mockMordidaApi } from "./mordida-fixtures";

const headers = {
  "access-control-allow-origin": new URL(
    process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
  ).origin,
  "access-control-allow-credentials": "true",
};

test("kitchen waits for a slow round and stops after navigation", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await page.clock.install();
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/admin/orders/kitchen", async (route) => {
    calls++;
    await gate;
    await route.fulfill({ headers, json: [] }).catch(() => {});
  });
  await page.goto("/admin/cocina");
  await expect.poll(() => calls).toBeGreaterThan(0);
  await page.waitForTimeout(300);
  const initialCalls = calls;
  await page.clock.runFor(10000);
  expect(calls).toBe(initialCalls);
  release();
  await expect(
    page.getByText("No se pudieron cargar los pedidos de cocina."),
  ).toHaveCount(0);
  // Let response handlers schedule the next timeout before advancing the clock.
  await page.waitForTimeout(100);
  await page.clock.runFor(2100);
  await expect.poll(() => calls).toBeGreaterThan(initialCalls);
  await page.locator('a[href="/admin/menu"]').first().click();
  await expect(page).toHaveURL(/\/admin\/menu$/);
  const stoppedAt = calls;
  await page.clock.runFor(10000);
  expect(calls).toBe(stoppedAt);
});

test("kitchen backs off after an error and recovers", async ({ page }) => {
  await mockMordidaApi(page);
  await page.clock.install();
  let calls = 0;
  let failing = true;
  await page.route("**/admin/orders/kitchen", async (route) => {
    calls++;
    await route.fulfill({
      headers,
      status: failing ? 500 : 200,
      json: failing ? { message: "Error temporal de prueba" } : [],
    });
  });
  await page.goto("/admin/cocina");
  await expect(page.getByText("Error temporal de prueba")).toBeVisible();
  const initialCalls = calls;
  await page.clock.runFor(2500);
  expect(calls).toBe(initialCalls);
  failing = false;
  await page.clock.runFor(1700);
  await expect.poll(() => calls).toBeGreaterThan(initialCalls);
  await expect(page.getByText("Error temporal de prueba")).toHaveCount(0);
});

test("cash desk refreshes orders without overwriting a draft or repeatedly loading settings", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await page.clock.install();
  let settings = 0;
  let orders = 0;
  await page.route("**/admin/settings", async (route) => {
    settings++;
    await route.fallback();
  });
  await page.route("**/admin/orders?**", async (route) => {
    orders++;
    await route.fallback();
  });
  await page.goto("/admin");
  await expect.poll(() => settings).toBeGreaterThan(0);
  await page.locator('button[aria-controls="admin-settings-panel"]').click();
  await page.getByRole("button", { name: "Negocio", exact: true }).click();
  const tax = page.locator('input[name="taxRate"]');
  await expect(tax).toHaveValue("10");
  await tax.fill("17");
  const initialSettings = settings;
  const initialOrders = orders;
  await page.clock.runFor(9000);
  await expect.poll(() => orders).toBeGreaterThan(initialOrders);
  expect(settings).toBe(initialSettings);
  await page.clock.runFor(22000);
  await expect.poll(() => settings).toBeGreaterThan(initialSettings);
  await expect(tax).toHaveValue("17");
  await expect(page.getByText("Pedido nuevo", { exact: true })).toBeVisible();
});

test("kitchen times out a stuck request and retries without ending the session", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await page.clock.install();
  let stuck = true;
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/admin/orders/kitchen", async (route) => {
    calls++;
    if (stuck) await gate;
    await route.fulfill({ headers, json: [] }).catch(() => {});
  });
  await page.goto("/admin/cocina");
  await expect.poll(() => calls).toBeGreaterThan(0);
  await page.waitForTimeout(200);
  const initial = calls;
  await page.clock.runFor(15100);
  await expect(
    page.getByText("La consulta ha tardado demasiado."),
  ).toBeVisible();
  expect(calls).toBe(initial);
  stuck = false;
  release();
  await page.clock.runFor(4200);
  await expect.poll(() => calls).toBeGreaterThan(initial);
  await expect(page.getByText("La consulta ha tardado demasiado.")).toHaveCount(
    0,
  );
  await expect(page).toHaveURL(/\/admin\/cocina$/);
});

test("changing filters discards an older in-flight result", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await page.clock.install();
  let hold = false;
  let held = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/admin/orders?**", async (route) => {
    if (new URL(route.request().url()).searchParams.get("q") === "nuevo") {
      await route.fulfill({ headers, json: [] });
    } else {
      if (hold) {
        held++;
        await gate;
      }
      await route.fallback().catch(() => {});
    }
  });
  await page.goto("/admin");
  await expect(page.getByText("MT-20260911-0001").first()).toBeVisible();
  hold = true;
  await page.clock.runFor(9000);
  await expect.poll(() => held).toBeGreaterThan(0);
  await page
    .getByRole("textbox", { name: "Buscar", exact: true })
    .fill("nuevo");
  await page.getByRole("button", { name: "Filtrar", exact: true }).click();
  await expect(page.getByText("MT-20260911-0001")).toHaveCount(0);
  release();
  await page.clock.runFor(9000);
  await expect(page.getByText("MT-20260911-0001")).toHaveCount(0);
});

test("tracking keeps the last order during errors and recovers", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await page.clock.install();
  let calls = 0;
  let failing = false;
  await page.route("**/orders/track/**", async (route) => {
    calls++;
    if (failing)
      await route.fulfill({
        headers,
        status: 500,
        json: { message: "Conexion temporalmente interrumpida" },
      });
    else await route.fallback();
  });
  await page.goto("/seguimiento/MT-20260911-0001?t=track-token-e2e");
  await expect(page.getByText("MT-20260911-0001").first()).toBeVisible();
  failing = true;
  await page.clock.runFor(11000);
  await expect(page.locator('main [role="alert"]')).toHaveText(
    "Conexion temporalmente interrumpida",
  );
  await expect(page.getByText("MT-20260911-0001").first()).toBeVisible();
  failing = false;
  const beforeRecovery = calls;
  await page.clock.runFor(21000);
  await expect.poll(() => calls).toBeGreaterThan(beforeRecovery);
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
});

test("shared refresh survives cancellation of the orders screen", async ({
  page,
}) => {
  await mockMordidaApi(page);
  let refreshed = false;
  let refreshCalls = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/admin/orders?**", async (route) => {
    if (!refreshed) await route.fulfill({ headers, status: 401, json: {} });
    else await route.fallback();
  });
  await page.route("**/admin/auth/refresh", async (route) => {
    refreshCalls++;
    await gate;
    refreshed = true;
    await route.fulfill({ headers, json: { ok: true } });
  });
  await page.goto("/admin");
  await expect.poll(() => refreshCalls).toBe(1);
  await page.locator('a[href="/admin/menu"]').first().click();
  await expect(page).toHaveURL(/\/admin\/menu$/);
  release();
  await page.locator('a[href="/admin"]').first().click();
  await expect(page.getByText("MT-20260911-0001").first()).toBeVisible();
  expect(refreshCalls).toBe(1);
  await expect(page).toHaveURL(/\/admin$/);
});

test("temporary refresh failure does not log the administrator out", async ({
  page,
}) => {
  await mockMordidaApi(page);
  await page.clock.install();
  let failing = true;
  let refreshed = false;
  await page.route("**/admin/orders?**", async (route) => {
    if (!refreshed) await route.fulfill({ headers, status: 401, json: {} });
    else await route.fallback();
  });
  await page.route("**/admin/auth/refresh", async (route) => {
    if (!failing) refreshed = true;
    await route.fulfill({ headers, status: failing ? 503 : 200, json: {} });
  });
  await page.goto("/admin");
  await expect(
    page.getByText("No se pudo renovar la sesion. Se reintentara la consulta."),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
  failing = false;
  await page.clock.runFor(17000);
  await expect(page.getByText("MT-20260911-0001").first()).toBeVisible();
  await expect(page).toHaveURL(/\/admin$/);
});
