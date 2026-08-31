import type { SiteContent } from "./types";

// Default brand configuration.
// Production content is editable from /admin/menu and stored in the API Setting table.
// Visual colors still live in app/globals.css under "Design tokens".
export const brandConfig = {
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
  supportEmail: "hola@mordidatasty.es",
} satisfies SiteContent & { supportEmail: string };
