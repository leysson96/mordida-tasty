'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { brandConfig } from '../lib/brand';
import type { SiteContent } from '../lib/types';

type BrandMarkContent = Pick<
  SiteContent,
  'name' | 'initials' | 'logoMode' | 'logoImageUrl' | 'logoAlt'
>;

export function BrandMark({
  compact = false,
  content = brandConfig
}: {
  compact?: boolean;
  content?: BrandMarkContent;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const initials = content.initials || brandConfig.initials;
  const logoMode = content.logoMode ?? 'INITIALS';
  const logoImageUrl = content.logoImageUrl?.trim() ?? '';
  const usesImage = logoMode === 'ICON' || logoMode === 'LOGO';
  const showImage = usesImage && logoImageUrl.length > 0 && !imageFailed;
  const markClassName = [
    'brand-mark',
    showImage ? 'brand-mark-image-mode' : '',
    showImage && logoMode === 'LOGO' ? 'brand-mark-logo-mode' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const showName = !compact && !(showImage && logoMode === 'LOGO');

  useEffect(() => {
    setImageFailed(false);
  }, [logoImageUrl, logoMode]);

  return (
    <span className="brand-lockup">
      <span className={markClassName} aria-hidden="true">
        {showImage ? (
          <Image
            src={logoImageUrl}
            alt=""
            fill
            sizes={logoMode === 'LOGO' ? '180px' : '46px'}
            className="brand-mark-image"
            onError={() => setImageFailed(true)}
          />
        ) : (
          initials
        )}
      </span>
      {showName && <span className="brand-name">{content.name}</span>}
    </span>
  );
}
