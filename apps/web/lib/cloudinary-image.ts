import type { ImageLoaderProps } from "next/image";

export function isPublicCloudinaryImage(src: unknown): src is string {
  if (typeof src !== "string") return false;
  try {
    const url = new URL(src);
    return (
      url.origin === "https://res.cloudinary.com" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/[a-zA-Z0-9_-]+\/image\/upload\/v\d+\/mordida-tasty\/images\/[a-zA-Z0-9_./-]+\.(png|jpe?g|webp)$/i.test(
        url.pathname,
      )
    );
  } catch {
    return false;
  }
}

export function cloudinaryImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  if (!isPublicCloudinaryImage(src)) return src;
  const url = new URL(src);
  const safeWidth = Math.max(1, Math.min(3840, Math.round(width) || 1));
  const safeQuality = Math.max(
    1,
    Math.min(100, Math.round(quality ?? 75) || 75),
  );
  // Limit preserves aspect ratio and avoids enlarging small originals.
  url.pathname = url.pathname.replace(
    "/image/upload/",
    `/image/upload/c_limit,w_${safeWidth},q_${safeQuality},f_auto/`,
  );
  return url.toString();
}
