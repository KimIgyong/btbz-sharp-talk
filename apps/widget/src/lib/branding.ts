import type { WidgetLogo } from './types';
import { getShopDomain } from '../hooks/useSession';
import { apiOrigin } from './api-client';

/**
 * Public URL for the tenant's logo (PLN-260819 S4 FR-T1).
 *
 * Unsigned and cached for a year on purpose — the widget paints this before
 * anyone is identified. `v` changes with every upload, which is what makes an
 * immutable cache safe.
 */
/** Public URL for a tenant design asset (font/icon) — versioned, cached hard (PLN-260910 P2). */
export function assetUrl(ref: { uuid: string; version: number }): string {
  return `${apiOrigin()}/public/widget/asset/${encodeURIComponent(ref.uuid)}?v=${encodeURIComponent(String(ref.version))}`;
}

export function logoUrl(logo: WidgetLogo): string {
  const shop = getShopDomain() ?? '';
  return `${apiOrigin()}/public/widget/logo?shop=${encodeURIComponent(shop)}&v=${encodeURIComponent(logo.id)}`;
}
