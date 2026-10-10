import { BRAND_MARK } from '@/lib/brand';

/** The mark sits 64 units tall, centred, on a 100-unit plate (same placement as app/icon.svg). */
const SCALE = 64 / BRAND_MARK.height;
const OFFSET = `translate(${50 - (BRAND_MARK.width * SCALE) / 2} ${50 - 32}) scale(${SCALE})`;

/**
 * The logo: an LED-pixel D on a rounded plate (geometry: shared/brand.json → lib/brand.ts). Follows the color
 * theme (plate = accent-fill, mark = accent-ink, highlighted pixel = brand-hi); `colors` draws it in fixed colors
 * instead (the color theme picker shows each theme's app icon).
 */
export function BrandMark({
  size = 24,
  colors,
  className,
}: {
  size?: number;
  colors?: { plate: string; ink: string; hi: string };
  className?: string;
}) {
  const ink = colors?.ink ?? 'rgb(var(--accent-ink))';
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden className={className}>
      <rect width="100" height="100" rx="23" style={{ fill: colors?.plate ?? 'rgb(var(--accent-fill))' }} />
      <g transform={OFFSET}>
        <path d={BRAND_MARK.body} fillRule="evenodd" style={{ fill: ink }} />
        <path d={BRAND_MARK.unlit} fillOpacity={BRAND_MARK.unlitAlpha} style={{ fill: ink }} />
        <path d={BRAND_MARK.accent} style={{ fill: colors?.hi ?? 'rgb(var(--brand-hi))' }} />
      </g>
    </svg>
  );
}
