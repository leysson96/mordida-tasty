"use client";

import { useState } from "react";
import Image from "next/image";
import { Product } from "../lib/types";

export function ProductImage({
  product,
  priority = false,
}: {
  product: Pick<Product, "name" | "imageUrl">;
  priority?: boolean;
}) {
  const [failedUrl, setFailedUrl] = useState<string>();
  const imageUrl =
    product.imageUrl && product.imageUrl !== failedUrl ? product.imageUrl : "";

  if (imageUrl) {
    return (
      <Image
        src={imageUrl}
        alt={product.name}
        width={900}
        height={900}
        sizes="(max-width: 820px) 100vw, 28vw"
        priority={priority}
        onError={() => setFailedUrl(imageUrl)}
      />
    );
  }

  return (
    <div className="image-fallback" aria-label={product.name}>
      {product.name.slice(0, 2).toUpperCase()}
    </div>
  );
}
