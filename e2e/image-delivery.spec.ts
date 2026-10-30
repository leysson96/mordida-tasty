import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  cloudinaryImageLoader,
  isPublicCloudinaryImage,
} from "../apps/web/lib/cloudinary-image";
import { mockMordidaApi } from "./mordida-fixtures";

const source =
  "https://res.cloudinary.com/mordida-test/image/upload/v123/mordida-tasty/images/2026-10/photo.png";

test("CDN loader preserves originals and excludes signed or special URLs", () => {
  expect(cloudinaryImageLoader({ src: source, width: 640 })).toBe(
    source.replace("/upload/", "/upload/c_limit,w_640,q_75,f_auto/"),
  );
  expect(
    cloudinaryImageLoader({ src: source, width: 20000, quality: 110 }),
  ).toContain("w_3840,q_100");
  for (const src of [
    "/images/menu/mordida-smash.png",
    "blob:https://example.com/123",
    "data:image/png;base64,AA",
    source + "?token=secret",
    source + "#fragment",
    source.replace("/upload/", "/upload/s--signature--/"),
    source.replace("/upload/", "/upload/w_640/"),
    source.replace("res.cloudinary.com", "res.cloudinary.com.attacker.test"),
    source.replace("https://", "http://"),
    source.replace("/image/upload/", "/image/private/"),
  ]) {
    expect(isPublicCloudinaryImage(src)).toBe(false);
    expect(cloudinaryImageLoader({ src, width: 640 })).toBe(src);
  }
});

test("Cloudinary hero, brand and products bypass the Next optimizer", async ({
  page,
}, testInfo) => {
  await mockMordidaApi(page, { imageUrl: source });
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.route("https://res.cloudinary.com/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      path: "apps/web/public/images/menu/mordida-smash.png",
    }),
  );
  await page.goto("/");
  const selectors = [
    ".sales-hero-image",
    ".brand-mark-image",
    ".product-card img",
  ];
  for (const selector of selectors) {
    const img = page.locator(selector).first();
    await img.scrollIntoViewIfNeeded();
    await expect(img).toHaveAttribute("src", /res\.cloudinary\.com.*c_limit/);
    await expect
      .poll(() =>
        img.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBeGreaterThan(0);
    expect(await img.getAttribute("srcset")).toContain("w_");
  }
  expect(
    requests.some(
      (url) => url.includes("/_next/image") && url.includes("cloudinary"),
    ),
  ).toBe(false);
  await mkdir("audit-artifacts/t1-image-delivery", { recursive: true });
  await page.screenshot({
    path: `audit-artifacts/t1-image-delivery/${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test("product fallback remains available on CDN failure", async ({ page }) => {
  await mockMordidaApi(page, { imageUrl: source });
  await page.route("https://res.cloudinary.com/**", (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.goto("/");
  const card = page.locator(".product-card", { hasText: "Mordida Smash" });
  await card.scrollIntoViewIfNeeded();
  await expect(card.locator(".image-fallback")).toBeVisible();
  await expect(card.getByTitle("Anadir al carrito")).toBeVisible();
});

test("local images keep their existing Next delivery", async ({ page }) => {
  await mockMordidaApi(page);
  await page.goto("/");
  const img = page.locator(".product-card img").first();
  await img.scrollIntoViewIfNeeded();
  await expect(img).toHaveAttribute("src", /\/_next\/image\?/);
  await expect
    .poll(() =>
      img.evaluate((element: HTMLImageElement) => element.naturalWidth),
    )
    .toBeGreaterThan(0);
});
