'use client';

import { useState } from 'react';
import { MediaItem, MediaPlayerData, Orientation, Slide } from '@/lib/api';
import { DraftUpdate } from '@/lib/useScreenDraft';
import { useRole } from '@/lib/session';
import { useT, msg } from '@/lib/i18n';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { ColorInput } from '@/components/ui/ColorInput';
import { EmptyState } from '@/components/ui/Misc';
import { Field, Label, NumberInput } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Toggle } from '@/components/ui/Toggle';
import { MediaPicker } from '@/components/media/MediaPicker';
import { MediaThumb } from '@/components/media/MediaThumb';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { InspectorCard } from '@/components/studio/StyleInspector';
import { MediaPlayerPreview, slideSeconds } from '@/components/previews/MediaPlayerPreview';
import { IconDown, IconImage, IconPause, IconPlay, IconTrash, IconUp } from '@/components/ui/icons';

const slideKey = (id: string) => `slide:${id}`;

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `s_${crypto.randomUUID().slice(0, 8)}`;
  return `s_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

const TRANSITIONS: { value: NonNullable<MediaPlayerData['transition']>; label: string }[] = [
  { value: 'fade', label: msg('Fade') },
  { value: 'slide', label: msg('Slide') },
  { value: 'none', label: msg('None') },
];

export function MediaPlayerEditor({
  orientation,
  draft,
  update,
}: {
  orientation: Orientation;
  draft: MediaPlayerData;
  update: DraftUpdate<MediaPlayerData>;
}) {
  const t = useT();
  const { canEdit } = useRole();
  const [selected, setSelected] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  const items = draft.items ?? [];
  const fallback = draft.defaultDurationSec ?? 10;
  const total = items.reduce((sum, s) => sum + slideSeconds(s, fallback), 0);

  function editSlide(id: string, patch: Partial<Slide>) {
    update((prev) => ({ items: (prev.items ?? []).map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }

  function addMedia(picked: MediaItem[]) {
    const added: Slide[] = picked.map((m) => ({
      id: uid(),
      mediaId: m.id,
      kind: m.kind,
      name: m.name,
      sha256: m.sha256,
      bytes: m.sizeBytes,
      width: m.width,
      height: m.height,
      durationMs: m.durationMs,
      avgColor: m.avgColor,
      fit: 'cover',
      fill: 'match',
      focalX: 50,
      focalY: 50,
      muted: true,
    }));
    update({ items: [...items, ...added] });
    if (added[0]) setIndex(items.length);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    update({ items: next });
    setIndex(j);
  }

  function remove(id: string) {
    update({ items: items.filter((s) => s.id !== id) });
    if (selected === slideKey(id)) setSelected(null);
    setIndex(0);
  }

  const content = (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>{t('Slides')}</Label>
          <p className="text-xs text-ink-3">
            {items.length === 0
              ? t('Add pictures or videos. One slide shows it full screen, several make a slideshow.')
              : t('{n} slides · about {time} per round', { n: items.length, time: formatDuration(total) })}
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setPicking(true)}>
            <IconImage className="h-4 w-4" /> {t('Add media')}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState icon={<IconImage />} title={t('No media yet')} description={t('Choose from your uploads or upload new pictures and videos.')} action={canEdit && <Button onClick={() => setPicking(true)}>{t('Add media')}</Button>} />
      ) : (
        <ul className="space-y-2">
          {items.map((s, i) => {
            const active = selected === slideKey(s.id) || (!selected && i === index);
            return (
              <li key={s.id}>
                <div
                  onClick={() => {
                    setIndex(i);
                    setSelected(slideKey(s.id));
                  }}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md border bg-surface p-2 transition-colors',
                    active ? 'border-accent ring-2 ring-accent/20' : 'border-line hover:border-line-strong',
                  )}
                >
                  <span className="w-5 flex-shrink-0 text-center font-mono text-xs tabular-nums text-ink-3">{i + 1}</span>
                  <div className="w-16 flex-shrink-0 overflow-hidden rounded-sm">
                    <MediaThumb asset={{ id: s.mediaId, kind: s.kind ?? 'image', durationMs: s.durationMs ?? null }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name ?? s.mediaId.slice(0, 8)}</p>
                    <p className="text-xs text-ink-3">
                      {s.kind === 'video' ? t('Video · plays to the end ({time})', { time: formatDuration(slideSeconds(s, fallback)) }) : t('Image · {n} s', { n: slideSeconds(s, fallback) })}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex flex-shrink-0 items-center" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label={t('Move up')}>
                        <IconUp className="h-4 w-4" />
                      </IconButton>
                      <IconButton size="sm" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={t('Move down')}>
                        <IconDown className="h-4 w-4" />
                      </IconButton>
                      <IconButton size="sm" onClick={() => remove(s.id)} aria-label={t('Remove slide')}>
                        <IconTrash className="h-4 w-4" />
                      </IconButton>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Card>
        <CardBody className="space-y-4">
          <Field label={t('Transition between slides')}>
            <SegmentedControl
              value={draft.transition ?? 'fade'}
              onChange={(transition) => update({ transition })}
              options={TRANSITIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
            />
          </Field>
          <Field label={t('Default time per image (seconds)')}>
            <div className="w-28">
              <NumberInput value={fallback} min={1} max={3600} disabled={!canEdit} onChange={(n) => update({ defaultDurationSec: Math.round(n) })} />
            </div>
          </Field>
          <Toggle checked={draft.shuffle ?? false} disabled={!canEdit} onChange={(shuffle) => update({ shuffle })} label={t('Shuffle the order')} description={t('A different order each round.')} />
        </CardBody>
      </Card>

      <MediaPicker open={picking} onClose={() => setPicking(false)} multiple onPick={addMedia} title={t('Add media')} origin="screen" crop="single" />
    </div>
  );

  const slide = items.find((s) => slideKey(s.id) === selected);

  return (
    <StudioLayout
      orientation={orientation}
      content={content}
      appearance={draft.appearance}
      onAppearanceChange={(appearance) => update({ appearance })}
      overlays={draft.overlays}
      styles={draft.styles}
      onOverlaysChange={(overlays) => update({ overlays })}
      onStylesChange={(styles) => update({ styles })}
      previewToolbar={
        items.length > 0 && (
          <div className="flex items-center">
            <IconButton size="sm" aria-label={t('Previous slide')} onClick={() => setIndex((index - 1 + items.length) % items.length)}>
              <IconDown className="h-4 w-4 rotate-90" />
            </IconButton>
            <IconButton size="sm" aria-label={playing ? t('Pause preview') : t('Play preview')} onClick={() => setPlaying((p) => !p)}>
              {playing ? <IconPause className="h-4 w-4" /> : <IconPlay className="h-4 w-4" />}
            </IconButton>
            <IconButton size="sm" aria-label={t('Next slide')} onClick={() => setIndex((index + 1) % items.length)}>
              <IconDown className="h-4 w-4 -rotate-90" />
            </IconButton>
          </div>
        )
      }
      preview={
        <MediaPlayerPreview
          data={draft}
          index={index}
          playing={playing}
          onIndexChange={setIndex}
          onPan={canEdit ? (id, focalX, focalY) => editSlide(id, { focalX, focalY }) : undefined}
        />
      }
      selected={selected}
      onSelect={(k) => {
        setSelected(k);
        const i = items.findIndex((s) => slideKey(s.id) === k);
        if (i >= 0) setIndex(i);
      }}
      inspector={
        slide && (
          <InspectorCard title={t('Slide {n}', { n: items.indexOf(slide) + 1 })} onClose={() => setSelected(null)}>
            <Field label={t('Fit')}>
              <SegmentedControl
                fullWidth
                value={slide.fit ?? 'cover'}
                onChange={(fit) => editSlide(slide.id, { fit })}
                options={[
                  { value: 'cover', label: t('Cover') },
                  { value: 'contain', label: t('Contain') },
                ]}
              />
            </Field>
            {(slide.fit ?? 'cover') === 'cover' && slide.kind === 'video' ? (
              <p className="text-xs text-ink-2">{t('Videos are cropped around their center.')}</p>
            ) : (slide.fit ?? 'cover') === 'cover' ? (
              <div className="space-y-2">
                <p className="text-xs text-ink-2">{t('Drag the picture in the preview to choose which part stays visible.')}</p>
                <Button variant="ghost" size="sm" onClick={() => editSlide(slide.id, { focalX: 50, focalY: 50 })}>
                  {t('Center the image')}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Field label={t('Empty space')}>
                  <SegmentedControl
                    fullWidth
                    value={slide.fill ?? 'match'}
                    onChange={(fill) => editSlide(slide.id, { fill })}
                    options={[
                      { value: 'match', label: t('Match image') },
                      { value: 'color', label: t('Color') },
                      { value: 'none', label: t('None') },
                    ]}
                  />
                </Field>
                {slide.kind === 'video' && (slide.fill ?? 'match') === 'match' && (
                  <p className="text-xs text-ink-3">{t('Videos cannot blur their own copy; the space is filled with the color below.')}</p>
                )}
                {(slide.fill === 'color' || (slide.kind === 'video' && (slide.fill ?? 'match') === 'match')) && (
                  <ColorInput value={slide.fillColor ?? '#000000'} onChange={(fillColor) => editSlide(slide.id, { fillColor })} />
                )}
              </div>
            )}
            {slide.kind === 'video' ? (
              <Toggle checked={slide.muted ?? true} onChange={(muted) => editSlide(slide.id, { muted })} label={t('Muted')} description={t('Most screens run without sound.')} />
            ) : (
              <Field label={t('Time on screen (seconds)')} hint={t('Empty = the default of {n} s.', { n: fallback })}>
                <div className="w-28">
                  <NumberInput value={slide.durationSec ?? fallback} min={1} max={3600} onChange={(n) => editSlide(slide.id, { durationSec: Math.round(n) })} />
                </div>
              </Field>
            )}
          </InspectorCard>
        )
      }
    />
  );
}
