import { BadRequestException } from "@nestjs/common";

const allowedLocalImagePrefixes = ["/images/", "/uploads/"] as const;
const cloudinaryImageHost = "res.cloudinary.com";
const cloudinaryImagePathPattern = /^\/[^/]+\/image\/upload\/.+/;
const imageUrlError =
  "Image must be an internal asset, API upload or Cloudinary image URL.";

export function normalizeOptionalImageUrl(
  value: string | undefined,
  apiPublicUrl: string,
) {
  const imageUrl = value?.trim();

  if (!imageUrl) {
    return undefined;
  }

  return normalizeAllowedImageUrl(imageUrl, apiPublicUrl);
}

export function normalizeRequiredImageUrl(
  value: unknown,
  fallback: string,
  apiPublicUrl: string,
) {
  const imageUrl = cleanText(value, fallback);
  if (!imageUrl) {
    return "";
  }

  return normalizeAllowedImageUrl(imageUrl, apiPublicUrl);
}

function normalizeAllowedImageUrl(imageUrl: string, apiPublicUrl: string) {
  if (isAllowedLocalImagePath(imageUrl)) {
    return imageUrl;
  }

  try {
    const parsed = new URL(imageUrl);
    if (
      isAllowedCloudinaryImageUrl(parsed) ||
      isAllowedApiUploadImageUrl(parsed, apiPublicUrl)
    ) {
      return parsed.toString();
    }
  } catch {
    throw new BadRequestException(imageUrlError);
  }

  throw new BadRequestException(imageUrlError);
}

function cleanText(value: unknown, fallback: string) {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed || fallback;
}

function isAllowedLocalImagePath(value: string) {
  return allowedLocalImagePrefixes.some((prefix) => value.startsWith(prefix));
}

function isAllowedCloudinaryImageUrl(value: URL) {
  return (
    value.protocol === "https:" &&
    value.hostname.toLowerCase() === cloudinaryImageHost &&
    cloudinaryImagePathPattern.test(value.pathname)
  );
}

function isAllowedApiUploadImageUrl(value: URL, apiPublicUrl: string) {
  try {
    const apiUrl = new URL(apiPublicUrl);
    return (
      value.protocol === apiUrl.protocol &&
      value.hostname.toLowerCase() === apiUrl.hostname.toLowerCase() &&
      normalizePort(value) === normalizePort(apiUrl) &&
      value.pathname.startsWith("/uploads/")
    );
  } catch {
    return false;
  }
}

function normalizePort(value: URL) {
  if (value.port) {
    return value.port;
  }

  if (value.protocol === "https:") {
    return "443";
  }

  if (value.protocol === "http:") {
    return "80";
  }

  return "";
}
