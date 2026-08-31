import { brandConfig } from '../lib/brand';
import type { SiteContent } from '../lib/types';

export function BrandMark({
  compact = false,
  content = brandConfig
}: {
  compact?: boolean;
  content?: Pick<SiteContent, 'name' | 'initials'>;
}) {
  return (
    <span className="brand-lockup">
      <span className="brand-mark" aria-hidden="true">
        {content.initials}
      </span>
      {!compact && <span className="brand-name">{content.name}</span>}
    </span>
  );
}
