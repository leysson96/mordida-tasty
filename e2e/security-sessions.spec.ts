import { expect, test } from "@playwright/test";

const apiPattern = "http://127.0.0.1:4010/**";

test("concurrent protected requests share one transparent refresh", async ({
  page,
}) => {
  let refreshed = false;
  let refreshCalls = 0;

  await page.route(apiPattern, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/refresh") {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 100));
      refreshed = true;
      return route.fulfill({ status: 200, json: { user: customer() } });
    }

    if (!refreshed) {
      return route.fulfill({ status: 401, json: { message: "expired" } });
    }

    if (path === "/auth/me") {
      return route.fulfill({ status: 200, json: customer() });
    }
    if (path === "/customers/addresses" || path === "/orders/mine") {
      return route.fulfill({ status: 200, json: [] });
    }
    if (path === "/customers/loyalty") {
      return route.fulfill({
        status: 200,
        json: { program: { enabled: false } },
      });
    }
    if (path === "/customers/cash-trust") {
      return route.fulfill({
        status: 200,
        json: { cashEnabled: false, successfulOrdersCount: 0 },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });

  await page.goto("/cuenta");
  await expect(page.getByRole("heading", { name: "Cliente Seguro" })).toBeVisible();
  expect(refreshCalls).toBe(1);
});

test("failed refresh redirects to login without retry loop", async ({ page }) => {
  let refreshCalls = 0;
  await page.route(apiPattern, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/refresh") {
      refreshCalls += 1;
    }
    return route.fulfill({ status: 401, json: { message: "expired" } });
  });

  await page.goto("/cuenta");
  await expect(page).toHaveURL(/\/auth\/login$/);
  expect(refreshCalls).toBe(1);
});

test("a public 401 does not trigger session refresh", async ({ page }) => {
  let refreshCalls = 0;
  await page.route(apiPattern, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/refresh" || path === "/admin/auth/refresh") {
      refreshCalls += 1;
    }
    if (path === "/settings/public") {
      return route.fulfill({ status: 200, json: publicSettings() });
    }
    return route.fulfill({ status: 401, json: { message: "public failure" } });
  });

  await page.goto("/");
  await page.waitForTimeout(300);
  expect(refreshCalls).toBe(0);
});

function customer() {
  return {
    id: "client-1",
    email: "cliente@mordida.test",
    name: "Cliente Seguro",
    phone: null,
    role: "CLIENTE",
    active: true,
    emailVerifiedAt: "2026-10-20T10:00:00.000Z",
    twoFactorEnabled: false,
    acceptedLegalAt: null,
    legalVersion: null,
    createdAt: "2026-10-20T10:00:00.000Z",
    updatedAt: "2026-10-20T10:00:00.000Z",
  };
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
