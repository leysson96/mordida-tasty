import { expect, test, type Page } from "@playwright/test";

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
    if (path === "/customers/commercial-consents") {
      return route.fulfill({ status: 200, json: [] });
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

test("two admin tabs serialize transparent refresh", async ({ context }) => {
  let refreshed = false;
  let refreshCalls = 0;
  let refreshInFlight = 0;
  let maxConcurrentRefreshes = 0;
  const initialPages = new Set<Page>();
  let releaseInitialRequests!: () => void;
  const bothTabsRequested = new Promise<void>((resolve) => {
    releaseInitialRequests = resolve;
  });

  await context.route(apiPattern, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/settings/public") {
      return route.fulfill({ status: 200, json: publicSettings() });
    }
    if (path === "/admin/auth/refresh") {
      refreshCalls += 1;
      refreshInFlight += 1;
      maxConcurrentRefreshes = Math.max(
        maxConcurrentRefreshes,
        refreshInFlight,
      );
      const overlapsAnotherRefresh = refreshInFlight > 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      refreshInFlight -= 1;
      if (overlapsAnotherRefresh) {
        return route.fulfill({ status: 401, json: { message: "reused" } });
      }
      refreshed = true;
      return route.fulfill({ status: 200, json: { user: admin() } });
    }
    if (!refreshed) {
      initialPages.add(route.request().frame().page());
      if (initialPages.size === 2) {
        releaseInitialRequests();
      }
      await bothTabsRequested;
      return route.fulfill({ status: 401, json: { message: "expired" } });
    }
    if (path === "/admin/auth/me") {
      return route.fulfill({ status: 200, json: admin() });
    }
    if (path === "/admin/users") {
      return route.fulfill({ status: 200, json: [] });
    }
    return route.fulfill({ status: 404, json: {} });
  });

  const firstTab = await context.newPage();
  const secondTab = await context.newPage();
  await Promise.all([firstTab.goto("/admin/staff"), secondTab.goto("/admin/staff")]);

  await expect.poll(() => refreshCalls).toBe(2);
  await expect(firstTab.getByRole("heading", { name: "Staff" })).toBeVisible();
  await expect(secondTab.getByRole("heading", { name: "Staff" })).toBeVisible();
  expect(maxConcurrentRefreshes).toBe(1);
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

function admin() {
  return {
    id: "admin-1",
    email: "admin@mordida.test",
    name: "Admin Seguro",
    phone: null,
    role: "ADMIN",
    active: true,
    emailVerifiedAt: "2026-10-20T10:00:00.000Z",
    twoFactorEnabled: true,
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
