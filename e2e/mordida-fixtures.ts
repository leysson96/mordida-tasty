import type { Page, Route } from "@playwright/test";

const pageOrigin = new URL(
  process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
).origin;
const now = "2026-09-11T12:00:00.000Z";
const heroImage = "/images/menu/mordida-smash.png";

export interface ApiMockState {
  checkoutRequests: number;
  createdOrders: number;
  uploadedHeroSaved: boolean;
}

export async function mockMordidaApi(page: Page): Promise<ApiMockState> {
  const state: ApiMockState = {
    checkoutRequests: 0,
    createdOrders: 0,
    uploadedHeroSaved: false,
  };

  await page.addInitScript(() => {
    window.localStorage.setItem("mordida_cookie_consent", "technical");
  });

  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (!isMockedApiRequest(method, pathname)) {
      await route.continue();
      return;
    }

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }

    if (method === "GET" && pathname === "/menu") {
      await json(route, menuFixture);
      return;
    }

    if (method === "GET" && pathname === "/settings/public") {
      await json(route, publicSettingsFixture);
      return;
    }

    if (method === "GET" && pathname === "/settings/delivery-quote") {
      await json(route, deliveryQuoteFixture);
      return;
    }

    if (method === "POST" && pathname === "/auth/register") {
      await json(route, { verificationToken: "verify-token-e2e" }, 201);
      return;
    }

    if (method === "POST" && pathname === "/auth/login") {
      await json(route, { user: customerFixture });
      return;
    }

    if (method === "GET" && pathname === "/auth/me") {
      await json(route, customerFixture);
      return;
    }

    if (method === "GET" && pathname === "/customers/addresses") {
      await json(route, [addressFixture]);
      return;
    }

    if (method === "GET" && pathname === "/customers/loyalty") {
      await json(route, loyaltyFixture);
      return;
    }

    if (method === "GET" && pathname === "/orders/mine") {
      await json(route, [trackingOrderFixture]);
      return;
    }

    if (method === "POST" && pathname === "/orders") {
      state.createdOrders += 1;
      await json(route, orderFromRequest(route), 201);
      return;
    }

    if (method === "POST" && pathname === "/payments/checkout") {
      state.checkoutRequests += 1;
      await json(route, {
        checkoutUrl: "https://checkout.stripe.test/pay/cs_test_mock",
        orderNumber: "MT-20260911-0001",
      });
      return;
    }

    if (method === "GET" && pathname.startsWith("/orders/track/")) {
      await json(route, trackingOrderFixture);
      return;
    }

    if (method === "POST" && pathname === "/admin/auth/login") {
      await json(route, { user: adminFixture });
      return;
    }

    if (method === "POST" && pathname === "/admin/auth/2fa/setup") {
      await json(route, {
        secret: "JBSWY3DPEHPK3PXP",
        otpauthUrl:
          "otpauth://totp/Mordida%20Tasty:admin%40mordida.test?secret=JBSWY3DPEHPK3PXP&issuer=Mordida%20Tasty",
      });
      return;
    }

    if (method === "POST" && pathname === "/admin/auth/2fa/confirm") {
      await json(route, { ok: true });
      return;
    }

    if (method === "GET" && pathname === "/admin/orders") {
      await json(route, [trackingOrderFixture]);
      return;
    }

    if (method === "GET" && pathname === "/admin/dashboard") {
      await json(route, {
        date: "2026-09-11",
        paidRevenueCents: 1190,
        ordersByStatus: { PAID: 1 },
      });
      return;
    }

    if (method === "GET" && pathname === "/admin/settings") {
      await json(route, adminSettingsFixture);
      return;
    }

    if (method === "GET" && pathname === "/admin/products") {
      await json(route, adminProductsFixture);
      return;
    }

    if (method === "GET" && pathname === "/admin/categories") {
      await json(route, categoriesFixture);
      return;
    }

    if (method === "POST" && pathname === "/admin/uploads/images") {
      await json(route, {
        url: "https://res.cloudinary.com/demo/image/upload/v1/e2e/hero.png",
        originalName: "hero.png",
        mimeType: "image/png",
        size: 68,
      }, 201);
      return;
    }

    if (method === "PATCH" && pathname === "/admin/settings/site-content") {
      const body = requestBody(route);
      state.uploadedHeroSaved =
        body.heroImage ===
        "https://res.cloudinary.com/demo/image/upload/v1/e2e/hero.png";
      await json(route, { ...siteContentFixture, heroImage });
      return;
    }

    if (method === "GET" && pathname === "/admin/reports/sales") {
      await json(route, salesReportFixture(url));
      return;
    }

    if (method === "GET" && pathname === "/admin/orders/history") {
      await json(route, {
        orders: [trackingOrderFixture],
        total: 1,
        page: Number(url.searchParams.get("page") ?? 1),
        pageSize: Number(url.searchParams.get("pageSize") ?? 100),
        totalPages: 1,
      });
      return;
    }

    await json(route, { message: `Unhandled E2E route ${method} ${pathname}` }, 404);
  });

  await page.route("https://checkout.stripe.test/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Stripe mock</title><h1>Stripe Checkout mock</h1>",
    });
  });

  return state;
}

function isMockedApiRequest(method: string, pathname: string) {
  if (method === "OPTIONS") {
    return isApiPath(pathname);
  }

  if (method === "GET") {
    return (
      pathname === "/menu" ||
      pathname === "/settings/public" ||
      pathname === "/settings/delivery-quote" ||
      pathname === "/auth/me" ||
      pathname === "/customers/addresses" ||
      pathname === "/customers/loyalty" ||
      pathname === "/orders/mine" ||
      pathname.startsWith("/orders/track/") ||
      pathname === "/admin/orders" ||
      pathname === "/admin/dashboard" ||
      pathname === "/admin/settings" ||
      pathname === "/admin/products" ||
      pathname === "/admin/categories" ||
      pathname === "/admin/reports/sales" ||
      pathname === "/admin/orders/history"
    );
  }

  if (method === "POST") {
    return (
      pathname === "/auth/register" ||
      pathname === "/auth/login" ||
      pathname === "/orders" ||
      pathname === "/payments/checkout" ||
      pathname === "/admin/auth/login" ||
      pathname === "/admin/auth/2fa/setup" ||
      pathname === "/admin/auth/2fa/confirm" ||
      pathname === "/admin/uploads/images"
    );
  }

  return method === "PATCH" && pathname === "/admin/settings/site-content";
}

function isApiPath(pathname: string) {
  return (
    pathname === "/menu" ||
    pathname.startsWith("/settings/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/customers/") ||
    pathname === "/orders" ||
    pathname.startsWith("/orders/") ||
    pathname.startsWith("/payments/") ||
    pathname.startsWith("/admin/auth/") ||
    pathname === "/admin/orders" ||
    pathname === "/admin/dashboard" ||
    pathname === "/admin/settings" ||
    pathname === "/admin/products" ||
    pathname === "/admin/categories" ||
    pathname === "/admin/uploads/images" ||
    pathname === "/admin/settings/site-content" ||
    pathname === "/admin/reports/sales" ||
    pathname === "/admin/orders/history"
  );
}

function requestBody(route: Route): Record<string, unknown> {
  const body = route.request().postData();
  if (!body) {
    return {};
  }

  return JSON.parse(body) as Record<string, unknown>;
}

function orderFromRequest(route: Route) {
  const body = requestBody(route);
  const deliveryMethod = body.deliveryMethod === "DELIVERY" ? "DELIVERY" : "PICKUP";
  const paymentMethod = body.paymentMethod === "CARD" ? "CARD" : "CASH";
  const cashTenderedCents =
    typeof body.cashTenderedCents === "number" ? body.cashTenderedCents : null;

  return {
    ...trackingOrderFixture,
    deliveryMethod,
    paymentMethod,
    cashTenderedCents,
    cashChangeCents:
      cashTenderedCents === null ? null : Math.max(0, cashTenderedCents - 1440),
    deliveryFeeCents: deliveryMethod === "DELIVERY" ? 250 : 0,
    totalCents: deliveryMethod === "DELIVERY" ? 1440 : 1190,
  };
}

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    headers: corsHeaders(route),
    json: body,
  });
}

function corsHeaders(route: Route) {
  const origin = route.request().headers().origin ?? pageOrigin;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type,idempotency-key",
  };
}

const siteContentFixture = {
  name: "Mordida Tasty",
  initials: "MT",
  tagline: "Smash burgers, entrantes y limonadas listas para hoy.",
  heroTitle: "Smash burgers hechas para pedir otra mordida.",
  heroText:
    "Carne marcada al momento, pan brioche tostado y salsas de la casa.",
  heroImage,
  featuredProductSlug: "mordida-smash",
  featuredProductName: "Mordida Smash",
  menuIntroText: "Smash jugosa y entrantes calientes.",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  instagramUrl: "https://instagram.com/mordidatasty",
  whatsappPhone: "+34600111222",
  locationTitle: "Ven a por tu mordida",
  locationText: "Recoge tu pedido caliente o abre la ruta en el movil.",
  businessAddress: "Rua Castrillon 37B, derecha",
  businessCity: "A Coruna",
  businessPostalCode: "15009",
  googleMapsUrl: "https://www.google.com/maps?q=Mordida+Tasty",
  aboutTitle: "Nosotros",
  aboutText: "Somos una cocina pequena enfocada en smash burgers al momento.",
};

const categoriesFixture = [
  {
    id: "category-1",
    name: "Hamburguesas",
    slug: "hamburguesas",
    active: true,
    sortOrder: 1,
    products: [
      {
        id: "product-1",
        categoryId: "category-1",
        name: "Mordida Smash",
        slug: "mordida-smash",
        description: "Doble carne smash, cheddar y salsa Mordida.",
        priceCents: 1190,
        imageUrl: heroImage,
        active: true,
        available: true,
        sortOrder: 1,
        optionGroups: [],
      },
      {
        id: "product-2",
        categoryId: "category-1",
        name: "Pollo Crujiente",
        slug: "pollo-crujiente",
        description: "Pollo marinado, rebozado crujiente y lima.",
        priceCents: 1090,
        imageUrl: "/images/menu/pollo-crujiente.png",
        active: true,
        available: true,
        sortOrder: 2,
        optionGroups: [],
      },
    ],
    _count: { products: 2 },
  },
];

const menuFixture = categoriesFixture;

const adminProductsFixture = categoriesFixture[0].products.map((product) => ({
  ...product,
  category: {
    id: "category-1",
    name: "Hamburguesas",
    slug: "hamburguesas",
    active: true,
    sortOrder: 1,
  },
}));

const openingHoursFixture = {
  timezone: "Europe/Madrid",
  weekly: {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  },
};

const loyaltyProgramFixture = {
  enabled: true,
  goalOrders: 5,
  rewardType: "DISCOUNT_PERCENT",
  discountPercent: 10,
  freeProductName: "Mordida Smash",
  title: "Mordida Club",
  description: "Completa pedidos y desbloquea una recompensa.",
};

const publicSettingsFixture = {
  taxRate: 0.1,
  deliveryFeeCents: 250,
  deliveryZones: [],
  openingHours: openingHoursFixture,
  openNow: true,
  serviceStatus: {
    openNow: true,
    pause: { paused: false, reason: "" },
  },
  siteContent: siteContentFixture,
  loyaltyProgram: loyaltyProgramFixture,
  legalVersion: "2026-09-11",
};

const deliveryQuoteFixture = {
  available: true,
  deliveryFeeCents: 250,
  minimumOrderCents: 0,
  reason: null,
  zone: {
    id: "zone-1",
    name: "A Coruna",
    postalCode: "15009",
    deliveryFeeCents: 250,
    minimumOrderCents: 0,
    active: true,
  },
};

const adminSettingsFixture = {
  ...publicSettingsFixture,
  ordersPause: { paused: false, reason: "" },
  specialClosures: [],
};

const customerFixture = {
  id: "customer-1",
  email: "cliente@mordida.test",
  name: "Cliente Mordida",
  phone: "+34600111222",
  role: "CLIENTE",
  active: true,
  emailVerifiedAt: now,
  twoFactorEnabled: false,
};

const adminFixture = {
  id: "admin-1",
  email: "admin@mordida.test",
  name: "Admin Mordida",
  phone: "+34600111223",
  role: "ADMIN",
  active: true,
  emailVerifiedAt: now,
  twoFactorEnabled: false,
};

const addressFixture = {
  id: "address-1",
  label: "Casa",
  recipientName: "Cliente Mordida",
  phone: "+34600111222",
  street: "Rua Vila de Ordes 1, p3",
  city: "A Coruna",
  postalCode: "15009",
  notes: "Portal en obra",
  isDefault: true,
};

const loyaltyFixture = {
  program: loyaltyProgramFixture,
  completedOrders: 2,
  progressOrders: 2,
  progressPercent: 40,
  ordersRemaining: 3,
  earnedRewards: 0,
  usedRewards: 0,
  availableRewards: 0,
  rewardReady: false,
  rewardLabel: "10% de descuento",
};

const trackingOrderFixture = {
  id: "order-1",
  orderNumber: "MT-20260911-0001",
  trackingToken: "track-token-e2e",
  status: "PAID",
  deliveryMethod: "DELIVERY",
  paymentMethod: "CASH",
  customerName: "Cliente Mordida",
  customerEmail: "cliente@mordida.test",
  customerPhone: "+34600111222",
  deliveryName: "Cliente Mordida",
  deliveryPhone: "+34600111222",
  deliveryStreet: "Rua Vila de Ordes 1, p3",
  deliveryCity: "A Coruna",
  deliveryPostalCode: "15009",
  deliveryNotes: "Portal en obra",
  subtotalCents: 1190,
  discountCents: 0,
  deliveryFeeCents: 250,
  taxCents: 131,
  cashTenderedCents: 2000,
  cashChangeCents: 560,
  totalCents: 1440,
  paidAt: now,
  createdAt: now,
  updatedAt: now,
  items: [
    {
      id: "order-item-1",
      productName: "Mordida Smash",
      quantity: 1,
      unitPriceCents: 1190,
      lineTotalCents: 1190,
      options: [],
    },
  ],
  statusHistory: [
    {
      toStatus: "PAID",
      note: "Pedido recibido.",
      createdAt: now,
    },
  ],
};

function salesReportFixture(url: URL) {
  return {
    from: url.searchParams.get("from") ?? "2026-09-01",
    to: url.searchParams.get("to") ?? "2026-09-11",
    totalRevenueCents: 1440,
    orderCount: 1,
    averageTicketCents: 1440,
    salesByDay: [
      {
        date: "2026-09-11",
        revenueCents: 1440,
        orderCount: 1,
      },
    ],
    topProducts: [
      {
        productName: "Mordida Smash",
        quantity: 1,
        revenueCents: 1190,
      },
    ],
  };
}
