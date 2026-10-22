'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { brandConfig } from '../lib/brand';
import type { SiteContent } from '../lib/types';

type BrandMarkContent = Pick<
  SiteContent,
  | 'name'
  | 'logoMode'
  | 'logoImageUrl'
  | 'brandSquareLogoUrl'
  | 'brandHeaderLogoUrl'
  | 'logoAlt'
>;

export function BrandMark({
  compact = false,
  content = brandConfig
}: {
  compact?: boolean;
  content?: BrandMarkContent;
}) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const logoMode = content.logoMode ?? 'INITIALS';
  const legacyLogoUrl = content.logoImageUrl?.trim() ?? '';
  const headerLogoUrl =
    content.brandHeaderLogoUrl?.trim() ||
    (logoMode === 'LOGO' ? legacyLogoUrl : '');
  const squareLogoUrl =
    content.brandSquareLogoUrl?.trim() ||
    (logoMode === 'ICON' ? legacyLogoUrl : '');
  const logoImageUrl = [headerLogoUrl, squareLogoUrl].find(
    (url) => url && !failedUrls.includes(url),
  );
  const showImage = Boolean(logoImageUrl);
  const showHorizontalLogo = logoImageUrl === headerLogoUrl;
  const markClassName = [
    'brand-mark',
    showImage ? 'brand-mark-image-mode' : '',
    showHorizontalLogo ? 'brand-mark-logo-mode' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const showName = !compact && !showHorizontalLogo;

  useEffect(() => {
    setFailedUrls([]);
  }, [headerLogoUrl, squareLogoUrl]);

  return (
    <span className="brand-lockup">
      {showImage && (
        <span className={markClassName}>
          <Image
            src={logoImageUrl!}
            alt={content.logoAlt || content.name}
            fill
            sizes={showHorizontalLogo ? '180px' : '46px'}
            className="brand-mark-image"
            onError={() =>
              setFailedUrls((current) =>
                current.includes(logoImageUrl!)
                  ? current
                  : [...current, logoImageUrl!],
              )
            }
          />
        </span>
      )}
      {showName && <span className="brand-name">{content.name}</span>}
    </span>
  );
}
