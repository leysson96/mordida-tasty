import { MenuClient } from '../components/menu-client';
import { brandConfig } from '../lib/brand';

export default function HomePage() {
  const siteUrl = safeSiteUrl();
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: brandConfig.name,
    description: brandConfig.heroText,
    url: siteUrl,
    logo: new URL('/brand-icon.png', siteUrl).toString(),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <MenuClient />
    </>
  );
}

function safeSiteUrl() {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://mordidatasty.es',
    );
  } catch {
    return new URL('https://mordidatasty.es');
  }
}
