import { NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MAX_LOGO_BYTES = 5_242_880;

interface PublicBrandSettings {
  siteContent?: {
    brandSquareLogoUrl?: unknown;
    logoImageUrl?: unknown;
    logoMode?: unknown;
  };
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settingsResponse = await fetch(`${API_URL}/settings/public`, {
      cache: "no-store",
    });
    if (!settingsResponse.ok) {
      return notFound();
    }

    const settings = (await settingsResponse.json()) as PublicBrandSettings;
    const siteContent = settings.siteContent;
    const squareLogoUrl = textValue(siteContent?.brandSquareLogoUrl);
    const legacyIconUrl =
      siteContent?.logoMode === "ICON"
        ? textValue(siteContent.logoImageUrl)
        : "";
    const imageUrl = allowedImageUrl(squareLogoUrl || legacyIconUrl);
    if (!imageUrl) {
      return notFound();
    }

    const imageResponse = await fetch(imageUrl, { cache: "no-store" });
    const contentType = imageResponse.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (!imageResponse.ok || contentType !== "image/png") {
      return notFound();
    }

    const declaredLength = Number(imageResponse.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_LOGO_BYTES) {
      return notFound();
    }

    const image = await imageResponse.arrayBuffer();
    if (
      image.byteLength === 0 ||
      image.byteLength > MAX_LOGO_BYTES ||
      !hasPngSignature(image)
    ) {
      return notFound();
    }

    return new NextResponse(image, {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
        "Content-Type": "image/png",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}

function hasPngSignature(image: ArrayBuffer) {
  const expected = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const signature = new Uint8Array(image, 0, Math.min(8, image.byteLength));
  return (
    signature.length === expected.length &&
    expected.every((byte, index) => signature[index] === byte)
  );
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function allowedImageUrl(value: string) {
  if (!value) {
    return undefined;
  }

  try {
    const apiOrigin = new URL(API_URL).origin;
    const url = new URL(value, apiOrigin);
    const cloudinaryLogo =
      url.protocol === "https:" && url.hostname === "res.cloudinary.com";
    const localUpload =
      url.origin === apiOrigin && url.pathname.startsWith("/uploads/images/");
    return cloudinaryLogo || localUpload ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function notFound() {
  return new NextResponse(null, {
    status: 404,
    headers: { "Cache-Control": "no-store" },
  });
}
