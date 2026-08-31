import type { Metadata } from 'next';
import { CartProvider } from '../components/cart-provider';
import { CookieBanner } from '../components/cookie-banner';
import { SiteHeader } from '../components/site-header';
import { brandConfig } from '../lib/brand';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: brandConfig.name,
    template: `%s | ${brandConfig.name}`
  },
  description: brandConfig.heroText
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <CartProvider>
          <SiteHeader />
          {children}
          <CookieBanner />
        </CartProvider>
      </body>
    </html>
  );
}
