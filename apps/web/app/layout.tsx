import type { Metadata } from "next";
import { CartProvider } from "../components/cart-provider";
import { CookieBanner } from "../components/cookie-banner";
import { GoogleAnalytics } from "../components/google-analytics";
import { GoogleConsentDefaults } from "../components/google-consent-defaults";
import { SiteHeader } from "../components/site-header";
import { brandConfig } from "../lib/brand";
import "./globals.css";

const publicSiteUrl = safePublicSiteUrl();

export const metadata: Metadata = {
  metadataBase: publicSiteUrl,
  applicationName: brandConfig.name,
  title: {
    default: brandConfig.name,
    template: `%s | ${brandConfig.name}`,
  },
  description: brandConfig.heroText,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/brand-icon.png", type: "image/png", sizes: "any" }],
    apple: [{ url: "/brand-icon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: brandConfig.name,
    title: brandConfig.name,
    description: brandConfig.heroText,
    url: "/",
    images: [{ url: "/brand-icon.png", alt: brandConfig.name }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <GoogleConsentDefaults />
        <GoogleAnalytics />
        <CartProvider>
          <SiteHeader />
          {children}
          <CookieBanner />
        </CartProvider>
      </body>
    </html>
  );
}

function safePublicSiteUrl() {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://mordidatasty.es",
    );
  } catch {
    return new URL("https://mordidatasty.es");
  }
}
