'use client';

import { Badge, Banner, ElementStyles, Overlays, Palette } from '@/lib/api';
import { resolveStyle, textCss, u } from '@/lib/design';
import { MediaBox } from '@/components/media/MediaBox';
import { Sel, useSelection } from '@/components/studio/Selection';
import type { StyleSpec } from '@/lib/design';

export const bannerKey = (id: string) => `banner:${id}`;
export const badgeKey = (id: string) => `badge:${id}`;

/** Default text style of banners and badges (Android OverlayLayer uses the same). */
export const BANNER_TEXT: StyleSpec = { font: 'roboto', size: 56, weight: 700, color: 'text', italic: false, align: 'center' };
export const BADGE_TEXT: StyleSpec = { font: 'roboto', size: 40, weight: 800, color: 'text', italic: false, align: 'center' };

const flex = (extra: React.CSSProperties = {}): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  ...extra,
});

function BannerView({
  banner,
  palette,
  styles,
  onChange,
}: {
  banner: Banner;
  palette: Palette;
  styles?: ElementStyles;
  onChange?: (id: string, patch: Partial<Banner>) => void;
}) {
  const sel = useSelection();
  const key = bannerKey(banner.id);
  const active = sel?.selected === key;
  const text = resolveStyle(BANNER_TEXT, styles?.[key]);

  const inner =
    banner.kind === 'image' ? (
      <MediaBox
        asset={banner.media}
        fit={banner.fit ?? 'cover'}
        focalX={banner.focalX}
        focalY={banner.focalY}
        fill={banner.fill ?? 'match'}
        fillColor={banner.fillColor}
        onPan={active && onChange ? (focalX, focalY) => onChange(banner.id, { focalX, focalY }) : undefined}
      />
    ) : (
      <div className="h-full w-full" style={{ ...flex({ padding: `0 ${u(32)}` }), backgroundColor: banner.background ?? palette.accent, ...textCss(text, palette) }}>
        <span className="min-w-0 truncate">{banner.text || ' '}</span>
      </div>
    );

  return (
    <Sel k={key} className="flex-none overflow-hidden" style={{ height: `${banner.heightPct}%` }}>
      {inner}
    </Sel>
  );
}

function BadgeView({
  badge,
  palette,
  styles,
  onChange,
}: {
  badge: Badge;
  palette: Palette;
  styles?: ElementStyles;
  onChange?: (id: string, patch: Partial<Badge>) => void;
}) {
  const sel = useSelection();
  const key = badgeKey(badge.id);
  const active = sel?.selected === key;
  const size = badge.sizePct * 10.8;
  const margin = (badge.marginPct ?? 2) * 10.8;
  const radius = badge.shape === 'circle' ? '50%' : badge.shape === 'rounded' ? u(size * 0.18) : 0;
  const text = resolveStyle(BADGE_TEXT, styles?.[key]);

  const position: React.CSSProperties = {
    position: 'absolute',
    width: u(size),
    height: u(size),
    [badge.corner.startsWith('t') ? 'top' : 'bottom']: u(margin),
    [badge.corner.endsWith('l') ? 'left' : 'right']: u(margin),
    borderRadius: radius,
    overflow: 'hidden',
    zIndex: 5,
  };

  return (
    <Sel k={key} className="" style={position}>
      {badge.kind === 'image' ? (
        <MediaBox
          asset={badge.media}
          fit={badge.fit ?? 'contain'}
          focalX={badge.focalX}
          focalY={badge.focalY}
          fill={badge.fill ?? 'none'}
          fillColor={badge.fillColor}
          onPan={active && onChange ? (focalX, focalY) => onChange(badge.id, { focalX, focalY }) : undefined}
        />
      ) : (
        <div className="h-full w-full" style={{ ...flex({ padding: u(size * 0.08) }), backgroundColor: badge.background ?? palette.accent, ...textCss(text, palette) }}>
          <span className="max-w-full break-words text-center leading-tight">{badge.text || ' '}</span>
        </div>
      )}
    </Sel>
  );
}

/**
 * Wraps a template preview with the screen's banners and badges, mirroring Android's
 * OverlayLayer: banners reserve space at the top/bottom, the template gets the rest,
 * badges float over a corner. `data-canvas` marks the template area so drag math in
 * editors uses it (not the whole screen).
 */
export function OverlayFrame({
  overlays,
  styles,
  palette,
  onBannerChange,
  onBadgeChange,
  children,
}: {
  overlays?: Overlays;
  styles?: ElementStyles;
  palette: Palette;
  onBannerChange?: (id: string, patch: Partial<Banner>) => void;
  onBadgeChange?: (id: string, patch: Partial<Badge>) => void;
  children: React.ReactNode;
}) {
  const banners = overlays?.banners ?? [];
  const badges = overlays?.badges ?? [];
  const top = banners.find((b) => b.position === 'top');
  const bottom = banners.find((b) => b.position === 'bottom');

  return (
    <div className="relative flex h-full w-full flex-col">
      {top && <BannerView banner={top} palette={palette} styles={styles} onChange={onBannerChange} />}
      <div data-canvas className="relative min-h-0 flex-1">
        {children}
      </div>
      {bottom && <BannerView banner={bottom} palette={palette} styles={styles} onChange={onBannerChange} />}
      {badges.map((b) => (
        <BadgeView key={b.id} badge={b} palette={palette} styles={styles} onChange={onBadgeChange} />
      ))}
    </div>
  );
}
