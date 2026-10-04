import { BadRequestException } from '@nestjs/common';
import { TemplateType } from '../screens/screen.entity';

type Obj = Record<string, unknown>;

const bad = (msg: string): never => {
  throw new BadRequestException(msg);
};
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

function oneOf(v: unknown, allowed: string[], field: string) {
  if (v !== undefined && !allowed.includes(v as string)) bad(`${field} must be one of: ${allowed.join(', ')}`);
}
function range(v: unknown, min: number, max: number, field: string) {
  if (v === undefined) return;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) bad(`${field} must be a number between ${min} and ${max}`);
}
function hex(v: unknown, field: string) {
  if (v !== undefined && !(typeof v === 'string' && /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(v))) {
    bad(`${field} must be a #rrggbb color`);
  }
}

/** Fields shared by every image/text box that can show a media file (slides, banners, badges). */
function checkFit(o: Obj, where: string) {
  oneOf(o.fit, ['cover', 'contain'], `${where}.fit`);
  oneOf(o.fill, ['match', 'color', 'none'], `${where}.fill`);
  hex(o.fillColor, `${where}.fillColor`);
  range(o.focalX, 0, 100, `${where}.focalX`);
  range(o.focalY, 0, 100, `${where}.focalY`);
}

function checkOverlays(value: unknown) {
  if (!isObj(value)) return bad('overlays must be an object');
  const { banners = [], badges = [] } = value as { banners?: unknown; badges?: unknown };
  if (!Array.isArray(banners) || banners.length > 2) bad('At most 2 banners (top and bottom) are allowed');
  if (!Array.isArray(badges) || badges.length > 4) bad('At most 4 badges (one per corner) are allowed');

  const positions = new Set<string>();
  for (const b of banners as unknown[]) {
    if (!isObj(b) || typeof b.id !== 'string') return bad('Every banner needs an id');
    oneOf(b.position, ['top', 'bottom'], 'banner.position');
    if (positions.has(b.position as string)) bad('Only one banner per position');
    positions.add(b.position as string);
    oneOf(b.kind, ['image', 'text'], 'banner.kind');
    range(b.heightPct, 3, 50, 'banner.heightPct');
    hex(b.background, 'banner.background');
    if (b.text !== undefined && (typeof b.text !== 'string' || b.text.length > 500)) bad('banner.text is too long');
    checkFit(b, 'banner');
  }
  const corners = new Set<string>();
  for (const b of badges as unknown[]) {
    if (!isObj(b) || typeof b.id !== 'string') return bad('Every badge needs an id');
    oneOf(b.corner, ['tl', 'tr', 'bl', 'br'], 'badge.corner');
    if (corners.has(b.corner as string)) bad('Only one badge per corner');
    corners.add(b.corner as string);
    oneOf(b.kind, ['image', 'text'], 'badge.kind');
    oneOf(b.shape, ['circle', 'rounded', 'square'], 'badge.shape');
    range(b.sizePct, 3, 40, 'badge.sizePct');
    range(b.marginPct, 0, 20, 'badge.marginPct');
    hex(b.background, 'badge.background');
    if (b.text !== undefined && (typeof b.text !== 'string' || b.text.length > 60)) bad('badge.text is too long');
    checkFit(b, 'badge');
  }
}

function checkItems(value: unknown) {
  if (!Array.isArray(value) || value.length > 200) return bad('items must be a list of at most 200 slides');
  for (const item of value as unknown[]) {
    if (!isObj(item) || typeof item.id !== 'string' || typeof item.mediaId !== 'string') {
      return bad('Every slide needs an id and a mediaId');
    }
    range(item.durationSec, 1, 3600, 'slide.durationSec');
    checkFit(item, 'slide');
  }
}

function checkUrl(value: unknown) {
  if (value === '' || value == null) return;
  if (typeof value !== 'string' || value.length > 2000) return bad('url is invalid');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return bad('url must be a valid http(s) address');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') bad('url must start with http:// or https://');
}

/**
 * Structural checks on the keys of screen data this server understands. Only keys
 * that are present are checked, so it validates a partial `merge` payload as well.
 * (Media ownership is verified separately by MediaService.normalizeRefs.)
 */
export function validateScreenData(template: TemplateType, data: Obj): void {
  if (data.overlays !== undefined && data.overlays !== null) checkOverlays(data.overlays);

  if (template === 'media-player') {
    if (data.items !== undefined && data.items !== null) checkItems(data.items);
    oneOf(data.transition, ['none', 'fade', 'slide'], 'transition');
    range(data.defaultDurationSec, 1, 3600, 'defaultDurationSec');
  }
  if (template === 'webview') {
    if ('url' in data) checkUrl(data.url);
    range(data.reloadSeconds, 0, 86_400, 'reloadSeconds');
  }
}
