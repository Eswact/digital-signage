'use client';

import { WebViewData } from '@/lib/api';
import { backgroundCss, resolvePalette } from '@/lib/design';
import { useT } from '@/lib/i18n';

/**
 * Counterpart of Android WebViewTemplate. The panel shows the page in an iframe;
 * some sites forbid being framed (X-Frame-Options) and will look blank here even
 * though they work on the device. `thumbnail` only draws the address.
 */
export function WebViewPreview({ data, thumbnail = false }: { data: WebViewData; thumbnail?: boolean }) {
  const t = useT();
  const palette = resolvePalette(data.appearance);
  const url = data.url?.trim();

  if (!url || thumbnail) {
    let host = url ?? '';
    try {
      host = url ? new URL(url).host : '';
    } catch {
      // keep raw
    }
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center text-center"
        style={{ background: backgroundCss(palette), color: palette.text, gap: 'calc(16 * var(--u))', padding: 'calc(48 * var(--u))' }}
      >
        <span style={{ fontSize: 'calc(120 * var(--u))', lineHeight: 1 }}>🌐</span>
        <span style={{ fontSize: 'calc(44 * var(--u))', fontFamily: "'SG Roboto', system-ui, sans-serif", color: url ? palette.text : palette.muted }}>
          {host || t('No address set')}
        </span>
      </div>
    );
  }
  return (
    <iframe
      key={url}
      src={url}
      title="Web page preview"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      className="h-full w-full border-0 bg-white"
      referrerPolicy="no-referrer"
    />
  );
}
