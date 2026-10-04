import { TemplateType } from '../screens/screen.entity';

/**
 * Şablon alan tanımı — panelde şema-driven form üretmek için.
 * Şu an tüm şablonların panelde özel editörü var (fields boş); basit yeni
 * şablonlar için mekanizma korunuyor.
 */
export interface TemplateFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'color' | 'number' | 'boolean';
  required?: boolean;
  default?: unknown;
}

export interface TemplateDefinition {
  type: TemplateType;
  label: string;
  /** Panelde ayrı/özel editör gerektiriyor mu. */
  customEditor?: boolean;
  fields: TemplateFieldSchema[];
  /** Default data for newly created screens. */
  defaultData: Record<string, unknown>;
  /**
   * Şablon veri şemasının sürümü. Cihaz kayıtta desteklediği sürümü bildirir
   * (Device.templates); uyumsuz değişiklikte artırılır.
   */
  version: number;
  /** Bu şablonu doğru çizen en düşük APK versionCode'u. */
  minAppVersion: number;
}

/*
 * --- Tüm şablonlarda ortak görünüm alanları (screen.data içinde) ---
 *
 * appearance?: {
 *   mode: 'dark' | 'light',
 *   preset: string,                 // hazır tema (midnight, navy, paper, …)
 *   colors?: {                      // hazır temanın üstüne özel renkler
 *     background?, background2?, surface?, card?, text?, muted?, accent?
 *   }                               // '#rrggbb' veya '#rrggbbaa'
 * }
 * styles?: {                        // öğe bazlı stil (önizlemede tıklanan öğe)
 *   [elementKey]: {
 *     font?: 'roboto' | 'inter' | 'montserrat' | 'oswald' | 'bebas' | 'playfair' | 'mono',
 *     size?: number,                // göreli birim: ekranın kısa kenarı = 1080
 *     color?: string, weight?: 400..900, italic?: boolean,
 *     align?: 'start' | 'center' | 'end'
 *   }
 * }
 *
 *
 * overlays?: {                      // banners & badges, valid on EVERY template
 *   banners: [{ id, position: 'top'|'bottom', heightPct, kind: 'image'|'text',
 *               media?: AssetRef, text?, fit: 'cover'|'contain', focalX, focalY (0-100),
 *               fill: 'match'|'color'|'none', fillColor?, background? }],
 *   badges:  [{ id, corner: 'tl'|'tr'|'bl'|'br', sizePct, marginPct, shape: 'circle'|'rounded'|'square',
 *               kind, media?, text?, fit, focalX, focalY, fill, fillColor?, background? }]
 * }                                 // banners reserve space; badges float over a corner.
 *                                   // Text uses styles['banner:<id>'] / styles['badge:<id>'].
 * AssetRef = { mediaId, kind, sha256, bytes, width, height, durationMs, avgColor }
 *            (descriptor fields are written by the server from the media library)
 *
 * Varsayılan stiller/paletler panel (lib/design.ts) ve Android (ui/design/)
 * tarafında aynı değerlerle tanımlıdır; data'da yalnızca kullanıcının
 * değiştirdiği özellikler tutulur.
 */

export const TEMPLATES: Record<TemplateType, TemplateDefinition> = {
  'order-board': {
    type: 'order-board',
    version: 1,
    minAppVersion: 2,
    label: 'Order Board',
    customEditor: true,
    fields: [],
    defaultData: {
      title: 'Orders',
      showLabel: true,
      showClock: true,
      appearance: { mode: 'dark', preset: 'midnight' },
      columns: [
        { id: 'prep', title: 'Preparing', accent: '#f59e0b' },
        { id: 'ready', title: 'Ready', accent: '#22c55e' },
      ],
      orders: [],
    },
  },
  'queue-number': {
    type: 'queue-number',
    version: 1,
    minAppVersion: 2,
    label: 'Queue Number',
    customEditor: true,
    fields: [],
    defaultData: {
      heading: 'Now serving',
      current: '—',
      currentName: '',
      subtitle: '',
      showQueue: false,
      queueTitle: 'Up next',
      showNames: true,
      queueLimit: 5,
      queue: [],
      appearance: { mode: 'dark', preset: 'navy' },
    },
  },
  'info-board': {
    type: 'info-board',
    version: 1,
    minAppVersion: 2,
    label: 'Info & Announcement Board',
    customEditor: true,
    fields: [],
    // Serbest yerleşim: her blok ekranın % koordinatlarında (sol-üst köşe + genişlik).
    defaultData: {
      appearance: { mode: 'dark', preset: 'midnight' },
      blocks: [
        {
          id: 'b_title',
          kind: 'text',
          text: 'Information',
          x: 6,
          y: 8,
          w: 88,
          style: { size: 80, weight: 700 },
        },
        {
          id: 'b_list',
          kind: 'list',
          items: ['First item', 'Second item'],
          bullet: 'dot',
          x: 6,
          y: 30,
          w: 88,
          style: { size: 44 },
        },
      ],
    },
  },
  'media-player': {
    type: 'media-player',
    version: 1,
    minAppVersion: 3,
    label: 'Media & Slideshow',
    customEditor: true,
    fields: [],
    // One slide = a still image or video; several slides = a slideshow. Image slides last
    // `durationSec` (default `defaultDurationSec`); videos play to the end.
    defaultData: {
      appearance: { mode: 'dark', preset: 'midnight' },
      items: [],
      transition: 'fade',
      defaultDurationSec: 10,
      shuffle: false,
    },
  },
  webview: {
    type: 'webview',
    version: 1,
    minAppVersion: 3,
    label: 'Web Page',
    customEditor: true,
    fields: [],
    // Shows an external page. Not available offline — the device keeps the page
    // it has loaded and reloads every `reloadSeconds` (0 = never).
    defaultData: {
      appearance: { mode: 'dark', preset: 'midnight' },
      url: '',
      reloadSeconds: 0,
    },
  },
};
