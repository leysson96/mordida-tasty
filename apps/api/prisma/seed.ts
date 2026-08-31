import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

const categories = [
  {
    name: "Hamburguesas",
    slug: "hamburguesas",
    products: [
      {
        name: "Mordida Smash",
        slug: "mordida-smash",
        description:
          "Doble carne smash, cheddar, cebolla caramelizada y salsa Mordida.",
        priceCents: 1190,
        imageUrl: "/images/menu/mordida-smash.png",
      },
      {
        name: "Pollo Crujiente",
        slug: "pollo-crujiente",
        description:
          "Pollo marinado, rebozado crujiente, lechuga, tomate y mayonesa de lima.",
        priceCents: 1090,
        imageUrl: "/images/menu/pollo-crujiente.png",
      },
    ],
  },
  {
    name: "Entrantes",
    slug: "entrantes",
    products: [
      {
        name: "Patatas Bravas Tasty",
        slug: "patatas-bravas-tasty",
        description: "Patatas doradas con salsa brava ahumada y alioli suave.",
        priceCents: 590,
        imageUrl: "/images/menu/patatas-bravas.png",
      },
      {
        name: "Nachos de la Casa",
        slug: "nachos-de-la-casa",
        description:
          "Totopos, queso fundido, pico de gallo, crema agria y jalapenos.",
        priceCents: 790,
        imageUrl: "/images/menu/nachos.png",
      },
    ],
  },
  {
    name: "Bebidas",
    slug: "bebidas",
    products: [
      {
        name: "Limonada Casera",
        slug: "limonada-casera",
        description: "Limonada natural con hierbabuena.",
        priceCents: 320,
        imageUrl: "/images/menu/limonada.png",
      },
    ],
  },
];

const defaultOpeningHours = {
  monday: [{ open: "12:00", close: "23:00" }],
  tuesday: [{ open: "12:00", close: "23:00" }],
  wednesday: [{ open: "12:00", close: "23:00" }],
  thursday: [{ open: "12:00", close: "23:00" }],
  friday: [{ open: "12:00", close: "23:30" }],
  saturday: [{ open: "12:00", close: "23:30" }],
  sunday: [{ open: "12:00", close: "23:00" }],
};

const developmentOpeningHours = {
  monday: [{ open: "00:00", close: "23:59" }],
  tuesday: [{ open: "00:00", close: "23:59" }],
  wednesday: [{ open: "00:00", close: "23:59" }],
  thursday: [{ open: "00:00", close: "23:59" }],
  friday: [{ open: "00:00", close: "23:59" }],
  saturday: [{ open: "00:00", close: "23:59" }],
  sunday: [{ open: "00:00", close: "23:59" }],
};

const defaultSiteContent = {
  name: "Mordida Tasty",
  initials: "MT",
  tagline: "Smash burgers, entrantes y limonadas listas para hoy.",
  heroTitle: "Smash burgers hechas para pedir otra mordida.",
  heroText:
    "Carne marcada al momento, pan brioche tostado y salsas de la casa. Pide online para recoger o recibir en casa.",
  heroImage: "/images/menu/mordida-smash.png",
  featuredProductSlug: "mordida-smash",
  featuredProductName: "Mordida Smash",
  menuIntroText:
    "Smash jugosa, pollo crujiente y entrantes calientes para pedir sin pensarlo.",
  fontFamily:
    'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
  instagramUrl: "",
  whatsappPhone: "",
};

async function main() {
  const production = process.env.NODE_ENV === "production";
  const adminEmail =
    process.env.MORDIDA_SEED_ADMIN_EMAIL ?? "admin@mordidatasty.es";
  const adminPassword = process.env.MORDIDA_SEED_ADMIN_PASSWORD;
  const kitchenEmail =
    process.env.MORDIDA_SEED_KITCHEN_EMAIL ?? "cocina@mordidatasty.es";
  const kitchenPassword = process.env.MORDIDA_SEED_KITCHEN_PASSWORD;
  const openingHours = production
    ? defaultOpeningHours
    : developmentOpeningHours;
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
  });

  if (!existingAdmin && !adminPassword && production) {
    throw new Error("MORDIDA_SEED_ADMIN_PASSWORD is required in production.");
  }

  const passwordHash = await argon2.hash(
    adminPassword ?? "Cambiar-esta-clave-123!",
  );

  await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      role: Role.ADMIN,
      ...(production ? {} : { active: true, disabledAt: null }),
      ...(production ? {} : { passwordHash }),
    },
    create: {
      email: adminEmail.toLowerCase(),
      name: "Admin Mordida Tasty",
      role: Role.ADMIN,
      active: true,
      emailVerifiedAt: new Date(),
      passwordHash,
    },
  });

  if (kitchenPassword || !production) {
    const kitchenPasswordHash = await argon2.hash(
      kitchenPassword ?? "Cambiar-cocina-123!",
    );

    await prisma.user.upsert({
      where: { email: kitchenEmail.toLowerCase() },
      update: {
        role: Role.KITCHEN,
        ...(production ? {} : { active: true, disabledAt: null }),
        ...(production ? {} : { passwordHash: kitchenPasswordHash }),
      },
      create: {
        email: kitchenEmail.toLowerCase(),
        name: "Cocina Mordida Tasty",
        role: Role.KITCHEN,
        active: true,
        emailVerifiedAt: new Date(),
        passwordHash: kitchenPasswordHash,
      },
    });
  }

  for (const [categoryIndex, category] of categories.entries()) {
    const savedCategory = await prisma.category.upsert({
      where: { slug: category.slug },
      update: production
        ? {}
        : {
            name: category.name,
            active: true,
            sortOrder: categoryIndex,
          },
      create: {
        name: category.name,
        slug: category.slug,
        active: true,
        sortOrder: categoryIndex,
      },
    });

    for (const [productIndex, product] of category.products.entries()) {
      await prisma.product.upsert({
        where: { slug: product.slug },
        update: production
          ? {}
          : {
              ...product,
              categoryId: savedCategory.id,
              active: true,
              available: true,
              sortOrder: productIndex,
            },
        create: {
          ...product,
          categoryId: savedCategory.id,
          active: true,
          available: true,
          sortOrder: productIndex,
        },
      });
    }
  }

  await prisma.setting.upsert({
    where: { key: "tax_rate" },
    update: production ? {} : { value: 0.1 },
    create: { key: "tax_rate", value: 0.1 },
  });

  await prisma.setting.upsert({
    where: { key: "delivery_fee_cents" },
    update: production ? {} : { value: 250 },
    create: { key: "delivery_fee_cents", value: 250 },
  });

  await prisma.setting.upsert({
    where: { key: "opening_hours" },
    update: production
      ? {}
      : {
          value: {
            timezone: process.env.APP_TIMEZONE ?? "Europe/Madrid",
            weekly: openingHours,
          },
        },
    create: {
      key: "opening_hours",
      value: {
        timezone: process.env.APP_TIMEZONE ?? "Europe/Madrid",
        weekly: openingHours,
      },
    },
  });

  await prisma.setting.upsert({
    where: { key: "site_content" },
    update: production ? {} : { value: defaultSiteContent },
    create: { key: "site_content", value: defaultSiteContent },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
