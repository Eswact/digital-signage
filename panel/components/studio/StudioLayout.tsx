'use client';

import { useState } from 'react';
import { Appearance, Badge, Banner, ElementStyles, Orientation, Overlays } from '@/lib/api';
import { resolvePalette } from '@/lib/design';
import { useMediaQuery } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { OverlayFrame } from '@/components/previews/OverlayFrame';
import { PreviewStage } from '@/components/studio/PreviewStage';
import { AppearancePanel } from '@/components/studio/AppearancePanel';
import { OverlayInspector, OverlaysPanel } from '@/components/studio/Overlays';
import { SelectionProvider } from '@/components/studio/Selection';

type Tab = 'content' | 'appearance' | 'overlays';

/** Selection keys that belong to banners/badges (inspected by OverlayInspector). */
const isOverlayKey = (k: string | null) => !!k && (k.startsWith('banner:') || k.startsWith('badge:'));

/**
 * Shared layout of the template editors: Content / Appearance / Banners & badges tabs next to a
 * preview with a resolution selector and the inspector of the element selected in it.
 * On wide screens the inspector docks under the preview; on phones it opens as a bottom sheet.
 */
export function StudioLayout({
  orientation,
  content,
  appearance,
  onAppearanceChange,
  overlays,
  styles,
  onOverlaysChange,
  onStylesChange,
  preview,
  previewToolbar,
  inspector,
  selected,
  onSelect,
}: {
  orientation: Orientation;
  content: React.ReactNode;
  appearance?: Appearance;
  onAppearanceChange: (next: Appearance) => void;
  overlays?: Overlays;
  styles?: ElementStyles;
  onOverlaysChange: (next: Overlays) => void;
  onStylesChange: (next: ElementStyles) => void;
  preview: React.ReactNode;
  previewToolbar?: React.ReactNode;
  /** Inspector for template elements (shown when the selection is not a banner/badge). */
  inspector: React.ReactNode;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>('content');
  const wide = useMediaQuery('(min-width: 1280px)');
  const palette = resolvePalette(appearance);

  const bannerChange = (id: string, change: Partial<Banner>) =>
    onOverlaysChange({
      banners: (overlays?.banners ?? []).map((b) => (b.id === id ? { ...b, ...change } : b)),
      badges: overlays?.badges ?? [],
    });
  const badgeChange = (id: string, change: Partial<Badge>) =>
    onOverlaysChange({
      banners: overlays?.banners ?? [],
      badges: (overlays?.badges ?? []).map((b) => (b.id === id ? { ...b, ...change } : b)),
    });

  const activeInspector =
    selected && isOverlayKey(selected) ? (
      <OverlayInspector
        selected={selected}
        value={overlays}
        onChange={onOverlaysChange}
        styles={styles}
        onStylesChange={onStylesChange}
        palette={palette}
        onClose={() => onSelect(null)}
      />
    ) : (
      selected && inspector
    );

  const hint = (
    <Card className="p-4 text-center text-sm text-ink-2">
      {t('Click an element in the preview to change its font, size and color.')}
    </Card>
  );

  return (
    <SelectionProvider value={{ selected, select: onSelect }}>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="order-2 min-w-0 space-y-4 xl:order-1">
          {/* Phones/tablets: the inspector sits right under the (sticky) preview. */}
          {!wide && activeInspector}
          <Tabs<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'content', label: t('Content') },
              { value: 'appearance', label: t('Appearance') },
              { value: 'overlays', label: t('Banners & badges'), count: (overlays?.banners.length ?? 0) + (overlays?.badges.length ?? 0) || undefined },
            ]}
          />
          {tab === 'content' && content}
          {tab === 'appearance' && <AppearancePanel value={appearance} onChange={onAppearanceChange} />}
          {tab === 'overlays' && <OverlaysPanel value={overlays} onChange={onOverlaysChange} selected={selected} onSelect={onSelect} />}
        </div>

        <div className="order-1 min-w-0 xl:sticky xl:top-6 xl:order-2 xl:max-h-[calc(100dvh-3rem)] xl:space-y-4 xl:overflow-y-auto xl:pb-2">
          {/* The preview stays in view while the controls below scroll. */}
          <div className="sticky top-14 z-10 -mx-4 border-b border-line bg-paper px-4 pb-3 pt-2 sm:-mx-6 sm:px-6 xl:static xl:z-auto xl:mx-0 xl:border-0 xl:p-0">
            <PreviewStage orientation={orientation} onCanvasClick={() => onSelect(null)} toolbar={previewToolbar} compact={!wide}>
              <OverlayFrame overlays={overlays} styles={styles} palette={palette} onBannerChange={bannerChange} onBadgeChange={badgeChange}>
                {preview}
              </OverlayFrame>
            </PreviewStage>
          </div>
          {wide && (activeInspector || hint)}
        </div>
      </div>
    </SelectionProvider>
  );
}
