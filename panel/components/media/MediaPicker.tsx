'use client';

import { useMemo, useState } from 'react';
import { MediaItem } from '@/lib/api';
import { useMedia } from '@/lib/queries';
import { useRole } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { EmptyState, Skeleton } from '@/components/ui/Misc';
import { IconCheck, IconMedia, IconUpload } from '@/components/ui/icons';
import { MediaThumb } from '@/components/media/MediaThumb';
import { UploadList, useMediaUpload } from '@/components/media/useMediaUpload';

/**
 * Pick files from the organization's uploads. Uploading from here adds the file to the
 * same library (and selects it), so nothing is ever stored twice.
 */
export function MediaPicker({
  open,
  onClose,
  onPick,
  multiple = false,
  kind,
  title,
  origin = 'screen',
  crop = 'single',
  initialAspect,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (items: MediaItem[]) => void;
  multiple?: boolean;
  kind?: 'image' | 'video';
  title?: string;
  origin?: 'screen' | 'overlay';
  crop?: 'never' | 'single' | 'always';
  initialAspect?: '16:9' | '9:16' | '4:3' | '1:1' | '32:9' | '9:32' | 'free';
}) {
  const t = useT();
  const { canEdit } = useRole();
  const media = useMedia();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const upload = useMediaUpload({
    origin,
    crop,
    initialAspect,
    multiple,
    accept: kind === 'image' ? 'image/jpeg,image/png,image/gif,image/webp' : kind === 'video' ? 'video/mp4,video/webm' : undefined,
    onUploaded: (asset) => setSelected((s) => (multiple ? [...s.filter((id) => id !== asset.id), asset.id] : [asset.id])),
  });

  const items = useMemo(
    () =>
      (media.data ?? []).filter(
        (m) => (!kind || m.kind === kind) && (!query || m.name.toLowerCase().includes(query.toLowerCase())),
      ),
    [media.data, kind, query],
  );

  function toggle(id: string) {
    setSelected((s) => (multiple ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id]));
  }

  function confirm() {
    const chosen = (media.data ?? []).filter((m) => selected.includes(m.id));
    // Keep the order in which the user picked.
    chosen.sort((a, b) => selected.indexOf(a.id) - selected.indexOf(b.id));
    onPick(chosen);
    setSelected([]);
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        setSelected([]);
        onClose();
      }}
      size="xl"
      title={title ?? t('Choose from uploads')}
      footer={
        <>
          <span className="mr-auto text-sm text-ink-3">{selected.length > 0 && t('{n} selected', { n: selected.length })}</span>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button disabled={selected.length === 0} onClick={confirm}>
            {t('Use selected')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search uploads')} className="min-w-0 flex-1 sm:max-w-xs" />
          {canEdit && (
            <Button variant="secondary" onClick={upload.open}>
              <IconUpload className="h-4 w-4" /> {t('Upload new')}
            </Button>
          )}
        </div>
        <UploadList uploads={upload.uploads} onDismiss={upload.dismiss} />
        {upload.host}

        {media.isLoading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon={<IconMedia />} title={t('Nothing here yet')} description={t('Upload images or videos and they will show up here.')} />
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {items.map((m) => {
              const on = selected.includes(m.id);
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggle(m.id)}
                    onDoubleClick={() => {
                      onPick([m]);
                      setSelected([]);
                      onClose();
                    }}
                    className={cn('group relative block w-full text-left', on && 'ring-2 ring-accent ring-offset-2 ring-offset-surface')}
                  >
                    <MediaThumb asset={m} />
                    {on && (
                      <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-ink">
                        <IconCheck className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="mt-1 block truncate text-xs text-ink-2">{m.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
