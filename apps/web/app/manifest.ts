import type { MetadataRoute } from "next";
import { brandConfig } from "../lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: brandConfig.name,
    short_name: brandConfig.name,
    description: brandConfig.heroText,
    start_url: "/",
    display: "standalone",
    background_color: "#fffaf4",
    theme_color: "#730006",
    icons: [
      {
        src: "/brand-icon.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/brand-icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
