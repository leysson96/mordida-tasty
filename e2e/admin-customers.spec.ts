import { expect, test, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";
import {
  crmScenarios,
  representativeCustomerList,
} from "./admin-customers-fixtures";

const apiPattern = /http:\/\/(?:127\.0\.0\.1:4010|localhost:4000)\/.*/;
const performanceBudgetMs = 2_000;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("mordida_cookie_consent", "technical");
  });
});

test("CRM list and detail preserve privacy, pagination and clean console", async ({
  page,
}, testInfo) => {
  const browserErrors = captureBrowserErrors(page);
  const state = await mockAdminCustomers(page);

  await page.goto("/admin/clientes");

  await expect(
    page.getByRole("heading", { name: "Clientes", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Listado" })).toBeVisible();
  await expect(page.getByText("1500 clientes")).toHaveCount(1);
  await expect(page.getByText("1-25 de 1500")).toBeVisible();
  for (const name of [
    "Cliente Nuevo",
    "Cliente En Desarrollo",
    "Cliente Activo",
    "Cliente Frecuente",
    "Cliente Inactivo",
    "Cliente Desactivado",
  ]) {
    await expect(page.getByText(name, { exact: true })).toBeVisible();
  }
  const disabledRow = page
    .getByRole("row")
    .filter({ hasText: "Cliente Desactivado" });
  await expect(
    disabledRow.getByText("Desactivado", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("cliente.4@example.test")).toHaveCount(0);
  await expect(page.getByText("+34610000000")).toHaveCount(0);

  const refreshStartedAt = Date.now();
  const refreshButton = page.getByRole("button", {
    name: "Actualizar clientes",
  });
  await refreshButton.click();
  await expect.poll(() => state.listRequests).toBeGreaterThanOrEqual(2);
  await expect(refreshButton).toBeEnabled();
  await expect(page.getByText("1-25 de 1500")).toBeVisible();
  expect(Date.now() - refreshStartedAt).toBeLessThan(performanceBudgetMs);

  await assertPageAccessibleStructure(page);
  await page
    .getByRole("button", {
      name: "Abrir ficha de Cliente Frecuente",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Cliente Frecuente" }),
  ).toBeVisible();
  await expect(dialog.getByText("Frecuente", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/112,40/)).toBeVisible();
  await expect(dialog.getByText("Autorizado", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Retirado", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("No registrado", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("cliente.4@example.test")).toHaveCount(0);

  await dialog.getByRole("button", { name: "Mostrar" }).click();
  await expect(dialog.getByText("cliente.4@example.test")).toBeVisible();
  await dialog.getByRole("button", { name: "Ocultar" }).click();
  await expect(dialog.getByText("cliente.4@example.test")).toHaveCount(0);

  await assertDialogAccessibleStructure(page);
  await assertNoPageOverflow(page);
  await saveGateScreenshot(page, testInfo, "detail");
  expect(state.maxPageSize).toBeLessThanOrEqual(100);
  expect(state.listRequests).toBeGreaterThanOrEqual(2);
  expect(browserErrors).toEqual([]);
});

test("CRM filters are server-side and anonymized accounts cannot reveal identity", async ({
  page,
}) => {
  const state = await mockAdminCustomers(page);
  await page.goto("/admin/clientes");
  await expect(page.getByText("1-25 de 1500")).toBeVisible();

  await page.getByLabel("Buscar cliente").fill("Cliente eliminado");
  await expect(page.getByText("1-1 de 1")).toBeVisible();
  await expect(page.getByText("Cuenta anonimizada")).toBeVisible();
  expect(state.lastQuery).toBe("Cliente eliminado");

  await page
    .getByRole("button", { name: "Abrir ficha de Cliente eliminado" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Datos anonimizados")).toBeVisible();
  await expect(
    dialog.getByText(
      "La identidad fue eliminada. No se reconstruyen datos desde pedidos.",
    ),
  ).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Mostrar" })).toHaveCount(0);
  await expect(dialog.getByText(/@anonymized\.invalid/)).toHaveCount(0);
});

test("CRM rejects an expired admin session without exposing customer data", async ({
  page,
}) => {
  await page.route(apiPattern, async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/settings/public") {
      return route.fulfill({ status: 200, json: publicSettings() });
    }
    return route.fulfill({ status: 401, json: { message: "Unauthorized" } });
  });

  await page.goto("/admin/clientes");
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(
    page.getByText("Cliente Frecuente", { exact: true }),
  ).toHaveCount(0);
});

test("CRM remains usable at tablet width", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Tablet audit runs once.");
  await page.setViewportSize({ width: 820, height: 1180 });
  const browserErrors = captureBrowserErrors(page);
  await mockAdminCustomers(page);

  await page.goto("/admin/clientes");
  await expect(
    page.getByRole("heading", { name: "Clientes", level: 1 }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Abrir ficha de Cliente Frecuente",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await assertNoPageOverflow(page);
  await saveGateScreenshot(page, testInfo, "tablet-detail");
  expect(browserErrors).toEqual([]);
});

async function mockAdminCustomers(page: Page) {
  const customers = representativeCustomerList();
  const details = new Map(
    Object.values(crmScenarios).map(({ detail }) => [
      detail.customer.id,
      detail,
    ]),
  );
  const state = {
    listRequests: 0,
    maxPageSize: 0,
    lastQuery: "",
  };

  await page.route(apiPattern, async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === "/settings/public") {
      return route.fulfill({ status: 200, json: publicSettings() });
    }

    if (pathname === "/admin/auth/refresh") {
      return route.fulfill({ status: 200, json: { ok: true } });
    }

    if (pathname === "/admin/customers") {
      state.listRequests += 1;
      const pageNumber = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 25);
      const query = (url.searchParams.get("q") ?? "").trim();
      const status = url.searchParams.get("status") ?? "ALL";
      state.maxPageSize = Math.max(state.maxPageSize, pageSize);
      state.lastQuery = query;

      let filtered = customers.filter((customer) => {
        const matchesStatus =
          status === "ALL" ||
          (status === "ACTIVE" ? customer.active : !customer.active);
      const contact = details.get(customer.id)?.customer;
      const searchable = `${customer.name} ${contact?.email ?? ""} ${contact?.phone ?? ""}`;
        return (
          matchesStatus &&
          searchable.toLowerCase().includes(query.toLowerCase())
        );
      });
      const sortBy = url.searchParams.get("sortBy");
      const direction =
        url.searchParams.get("sortDirection") === "ASC" ? 1 : -1;
      filtered = [...filtered].sort((left, right) => {
        const leftValue = sortValue(left, sortBy);
        const rightValue = sortValue(right, sortBy);
        return leftValue.localeCompare(rightValue) * direction;
      });
      const offset = (pageNumber - 1) * pageSize;
      await new Promise((resolve) => setTimeout(resolve, 75));

      return route.fulfill({
        status: 200,
        json: {
          items: filtered.slice(offset, offset + pageSize),
          pagination: {
            page: pageNumber,
            pageSize,
            total: filtered.length,
            totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
          },
        },
      });
    }

    const detailMatch = pathname.match(/^\/admin\/customers\/([^/]+)$/);
    if (detailMatch) {
      const detail = details.get(decodeURIComponent(detailMatch[1]));
      return route.fulfill({
        status: detail ? 200 : 404,
        json: detail ?? { message: "Customer not found." },
      });
    }

    return route.fulfill({
      status: 404,
      json: { message: `Unhandled CRM E2E route ${pathname}` },
    });
  });

  return state;
}

function sortValue(
  customer: ReturnType<typeof representativeCustomerList>[number],
  sortBy: string | null,
) {
  if (sortBy === "NAME") return customer.name;
  if (sortBy === "LAST_LOGIN_AT") return customer.lastLoginAt ?? "";
  return customer.createdAt;
}

function publicSettings() {
  return {
    taxRate: "0.10",
    deliveryFeeCents: 250,
    openNow: true,
    ordersPaused: false,
    openingHours: [],
    specialClosures: [],
    siteContent: {},
    promotion: { enabled: false },
  };
}

function captureBrowserErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function assertPageAccessibleStructure(page: Page) {
  await expect(page.getByRole("navigation", { name: "Admin" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Filtros de clientes" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Paginacion de clientes" }),
  ).toBeVisible();
}

async function assertDialogAccessibleStructure(page: Page) {
  await expect(
    page.getByRole("button", { name: "Cerrar ficha del cliente" }),
  ).toBeVisible();
  const duplicateIds = await page.locator("[id]").evaluateAll((elements) => {
    const ids = elements.map((element) => element.id).filter(Boolean);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);
}

async function assertNoPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth + 1,
      ),
    )
    .toBe(true);
}

async function saveGateScreenshot(
  page: Page,
  testInfo: TestInfo,
  suffix: string,
) {
  const fileName = `t17-crm-${testInfo.project.name}-${suffix}.png`;
  await page.screenshot({
    path: path.join(process.cwd(), "audit-artifacts", fileName),
    fullPage: true,
  });
}
