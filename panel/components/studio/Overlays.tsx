'use client';

import { useState } from 'react';
import {
  AssetRef,
  Badge,
  BadgeShape,
  Banner,
  Corner,
  Fill,
  Fit,
  MediaItem,
  Overlays,
  Palette,
  ElementStyles,
} from '@/lib/api';
import { useRole } from '@/lib/session';
import { useT, msg } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { BADGE_TEXT, BANNER_TEXT, badgeKey, bannerKey } from '@/components/previews/OverlayFrame';
import { Button } from '@/components/ui/Button';
import { ColorInput } from '@/components/ui/ColorInput';
import { Field, Input, NumberInput, Textarea } from '@/components/ui/Input';
import { Section } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Select } from '@/components/ui/Select';
import { MediaPicker } from '@/components/media/MediaPicker';
import { MediaThumb } from '@/components/media/MediaThumb';
import { InspectorCard, StyleInspector } from '@/components/studio/StyleInspector';
import { IconImage, IconPlus, IconTrash } from '@/components/ui/icons';

const uid = (prefix: string) =>
  `${prefix}_${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.floor(Math.random() * 1e9).toString(36)}`;

const toRef = (m: MediaItem): AssetRef => ({
  mediaId: m.id,
  kind: m.kind,
  sha256: m.sha256,
  bytes: m.sizeBytes,
  width: m.width,
  height: m.height,
  durationMs: m.durationMs,
  avgColor: m.avgColor,
});

const BANNER_SLOTS: { position: Banner['position']; label: string }[] = [
  { position: 'top', label: msg('Top banner') },
  { position: 'bottom', label: msg('Bottom banner') },
];
const BADGE_SLOTS: { corner: Corner; label: string }[] = [
  { corner: 'tl', label: msg('Top left badge') },
  { corner: 'tr', label: msg('Top right badge') },
  { corner: 'bl', label: msg('Bottom left badge') },
  { corner: 'br', label: msg('Bottom right badge') },
];

const normalize = (o?: Overlays): Overlays => ({ banners: o?.banners ?? [], badges: o?.badges ?? [] });

/** "Banners & badges" tab: one banner per top/bottom edge, one badge per corner. */
export function OverlaysPanel({
  value,
  onChange,
  selected,
  onSelect,
}: {
  value?: Overlays;
  onChange: (next: Overlays) => void;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const t = useT();
  const { canEdit } = useRole();
  const overlays = normalize(value);
  const [picking, setPicking] = useState<{ kind: 'banner'; position: Banner['position'] } | { kind: 'badge'; corner: Corner } | null>(null);

  function addBanner(position: Banner['position'], media?: MediaItem) {
    const banner: Banner = media
      ? { id: uid('bn'), position, heightPct: 14, kind: 'image', media: toRef(media), fit: 'cover', fill: 'match', focalX: 50, focalY: 50 }
      : { id: uid('bn'), position, heightPct: 10, kind: 'text', text: t('Your message here') };
    onChange({ ...overlays, banners: [...overlays.banners, banner] });
    onSelect(bannerKey(banner.id));
  }

  function addBadge(corner: Corner, media?: MediaItem) {
    const badge: Badge = media
      ? { id: uid('bd'), corner, sizePct: 14, marginPct: 2, shape: 'circle', kind: 'image', media: toRef(media), fit: 'contain', fill: 'none', focalX: 50, focalY: 50 }
      : { id: uid('bd'), corner, sizePct: 14, marginPct: 2, shape: 'circle', kind: 'text', text: t('NEW') };
    onChange({ ...overlays, badges: [...overlays.badges, badge] });
    onSelect(badgeKey(badge.id));
  }

  const slot = (label: string, item: Banner | Badge | undefined, key: string | null, add: { image: () => void; text: () => void }, remove: () => void) => (
    <li key={label} className={cn('flex items-center gap-3 px-4 py-3', key && selected === key && 'bg-accent-soft/50')}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{t(label)}</p>
        {item ? (
          <button type="button" onClick={() => onSelect(key)} className="mt-0.5 flex items-center gap-2 text-left text-xs text-ink-2 hover:text-ink">
            {item.kind === 'image' && item.media ? (
              <span className="block h-7 w-7 overflow-hidden rounded-sm">
                <MediaThumb asset={{ id: item.media.mediaId, kind: item.media.kind ?? 'image', durationMs: item.media.durationMs ?? null }} />
              </span>
            ) : null}
            <span className="truncate">{item.kind === 'image' ? t('Image') : item.text || t('Text')}</span>
            <span className="text-accent">{t('Edit')}</span>
          </button>
        ) : (
          <p className="text-xs text-ink-3">{t('Not set')}</p>
        )}
      </div>
      {canEdit &&
        (item ? (
          <Button variant="ghost" size="sm" onClick={remove} aria-label={t('Remove')}>
            <IconTrash className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" onClick={add.image}>
              <IconImage className="h-4 w-4" /> {t('Image')}
            </Button>
            <Button variant="secondary" size="sm" onClick={add.text}>
              <IconPlus className="h-4 w-4" /> {t('Text')}
            </Button>
          </div>
        ))}
    </li>
  );

  return (
    <div className="space-y-4">
      <Section
        title={t('Banners')}
        description={t('Strips across the top or bottom. They take space from the content.')}
      >
        <ul className="-mx-4 -my-4 divide-y divide-line sm:-mx-5 sm:-my-5">
          {BANNER_SLOTS.map(({ position, label }) => {
            const item = overlays.banners.find((b) => b.position === position);
            return slot(
              label,
              item,
              item ? bannerKey(item.id) : null,
              { image: () => setPicking({ kind: 'banner', position }), text: () => addBanner(position) },
              () => {
                onChange({ ...overlays, banners: overlays.banners.filter((b) => b.id !== item!.id) });
                if (selected === bannerKey(item!.id)) onSelect(null);
              },
            );
          })}
        </ul>
      </Section>

      <Section title={t('Badges')} description={t('Small round or square marks in a corner, floating over the content.')}>
        <ul className="-mx-4 -my-4 divide-y divide-line sm:-mx-5 sm:-my-5">
          {BADGE_SLOTS.map(({ corner, label }) => {
            const item = overlays.badges.find((b) => b.corner === corner);
            return slot(
              label,
              item,
              item ? badgeKey(item.id) : null,
              { image: () => setPicking({ kind: 'badge', corner }), text: () => addBadge(corner) },
              () => {
                onChange({ ...overlays, badges: overlays.badges.filter((b) => b.id !== item!.id) });
                if (selected === badgeKey(item!.id)) onSelect(null);
              },
            );
          })}
        </ul>
      </Section>

      <p className="text-xs text-ink-3">{t('Click a banner or badge in the preview to change its size, picture and style.')}</p>

      <MediaPicker
        open={!!picking}
        onClose={() => setPicking(null)}
        kind="image"
        origin="overlay"
        crop="always"
        initialAspect={picking?.kind === 'banner' ? '32:9' : '1:1'}
        title={picking?.kind === 'banner' ? t('Banner image') : t('Badge image')}
        onPick={([m]) => {
          if (!m || !picking) return;
          if (picking.kind === 'banner') addBanner(picking.position, m);
          else addBadge(picking.corner, m);
        }}
      />
    </div>
  );
}

/** Inspector for a selected banner or badge. */
export function OverlayInspector({
  selected,
  value,
  onChange,
  styles,
  onStylesChange,
  palette,
  onClose,
}: {
  selected: string;
  value?: Overlays;
  onChange: (next: Overlays) => void;
  styles?: ElementStyles;
  onStylesChange: (styles: ElementStyles) => void;
  palette: Palette;
  onClose: () => void;
}) {
  const t = useT();
  const overlays = normalize(value);
  const [replacing, setReplacing] = useState(false);

  const isBanner = selected.startsWith('banner:');
  const id = selected.slice(selected.indexOf(':') + 1);
  const banner = isBanner ? overlays.banners.find((b) => b.id === id) : undefined;
  const badge = !isBanner ? overlays.badges.find((b) => b.id === id) : undefined;
  const item = banner ?? badge;
  if (!item) return null;

  const patch = (change: Partial<Banner> & Partial<Badge>) =>
    onChange(
      isBanner
        ? { ...overlays, banners: overlays.banners.map((b) => (b.id === id ? { ...b, ...change } : b)) }
        : { ...overlays, badges: overlays.badges.map((b) => (b.id === id ? { ...b, ...change } : b)) },
    );

  const fit: Fit = item.fit ?? (isBanner ? 'cover' : 'contain');
  const fill: Fill = item.fill ?? (isBanner ? 'match' : 'none');
  const title = isBanner ? t(banner!.position === 'top' ? msg('Top banner') : msg('Bottom banner')) : t(BADGE_SLOTS.find((s) => s.corner === badge!.corner)!.label);

  // Size / placement fields shared by both kinds.
  const geometry = isBanner ? (
    <Field label={t('Height ({n}% of the screen)', { n: banner!.heightPct })}>
      <input
        type="range"
        min={3}
        max={50}
        value={banner!.heightPct}
        onChange={(e) => patch({ heightPct: Number(e.target.value) })}
        className="w-full accent-[rgb(var(--accent))]"
      />
    </Field>
  ) : (
    <div className="space-y-4">
      <Field label={t('Size ({n}% of the short side)', { n: badge!.sizePct })}>
        <input
          type="range"
          min={3}
          max={40}
          value={badge!.sizePct}
          onChange={(e) => patch({ sizePct: Number(e.target.value) })}
          className="w-full accent-[rgb(var(--accent))]"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('Shape')}>
          <SegmentedControl<BadgeShape>
            size="sm"
            value={badge!.shape}
            onChange={(shape) => patch({ shape })}
            options={[
              { value: 'circle', label: t('Circle') },
              { value: 'rounded', label: t('Rounded') },
              { value: 'square', label: t('Square') },
            ]}
          />
        </Field>
        <Field label={t('Corner distance (%)')}>
          <NumberInput value={badge!.marginPct ?? 2} min={0} max={20} step={0.5} onChange={(marginPct) => patch({ marginPct })} />
        </Field>
      </div>
      <Field label={t('Corner')}>
        <Select value={badge!.corner} onChange={(e) => patch({ corner: e.target.value as Corner })}>
          {BADGE_SLOTS.map((s) => (
            <option key={s.corner} value={s.corner} disabled={s.corner !== badge!.corner && overlays.badges.some((b) => b.corner === s.corner)}>
              {t(s.label)}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );

  if (item.kind === 'text') {
    const key = isBanner ? bannerKey(id) : badgeKey(id);
    return (
      <StyleInspector
        title={title}
        defaults={isBanner ? BANNER_TEXT : BADGE_TEXT}
        value={styles?.[key]}
        palette={palette}
        onClose={onClose}
        onChange={(style) => {
          const next = { ...(styles ?? {}) };
          if (style) next[key] = style;
          else delete next[key];
          onStylesChange(next);
        }}
      >
        <Field label={t('Text')}>
          {isBanner ? (
            <Textarea rows={2} value={banner!.text ?? ''} onChange={(e) => patch({ text: e.target.value })} />
          ) : (
            <Input value={badge!.text ?? ''} maxLength={60} onChange={(e) => patch({ text: e.target.value })} />
          )}
        </Field>
        <Field label={t('Background')}>
          <ColorInput value={item.background ?? palette.accent} onChange={(background) => patch({ background })} />
        </Field>
        {geometry}
      </StyleInspector>
    );
  }

  return (
    <InspectorCard title={title} onClose={onClose}>
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded border border-line">
          {item.media && <MediaThumb asset={{ id: item.media.mediaId, kind: item.media.kind ?? 'image', durationMs: null }} />}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setReplacing(true)}>
          {t('Replace image')}
        </Button>
      </div>

      <Field label={t('Fit')}>
        <SegmentedControl<Fit>
          fullWidth
          value={fit}
          onChange={(f) => patch({ fit: f })}
          options={[
            { value: 'cover', label: t('Cover') },
            { value: 'contain', label: t('Contain') },
          ]}
        />
      </Field>

      {fit === 'cover' ? (
        <div className="space-y-2">
          <p className="text-xs text-ink-2">{t('Drag the image in the preview to choose which part stays visible.')}</p>
          <Button variant="ghost" size="sm" onClick={() => patch({ focalX: 50, focalY: 50 })}>
            {t('Center the image')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <Field label={t('Empty space')}>
            <SegmentedControl<Fill>
              fullWidth
              value={fill}
              onChange={(f) => patch({ fill: f })}
              options={[
                { value: 'match', label: t('Match image') },
                { value: 'color', label: t('Color') },
                { value: 'none', label: t('None') },
              ]}
            />
          </Field>
          {fill === 'color' && <ColorInput value={item.fillColor ?? '#000000'} onChange={(fillColor) => patch({ fillColor })} />}
        </div>
      )}

      {geometry}

      <MediaPicker
        open={replacing}
        onClose={() => setReplacing(false)}
        kind="image"
        origin="overlay"
        crop="always"
        initialAspect={isBanner ? '32:9' : '1:1'}
        title={t('Replace image')}
        onPick={([m]) => m && patch({ media: toRef(m) })}
      />
    </InspectorCard>
  );
}
