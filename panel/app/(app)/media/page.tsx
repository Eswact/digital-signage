'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, mediaUrl, MediaItem } from '@/lib/api';
import { useRole } from '@/lib/session';
import { useMedia, useOrganization } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { formatBytes, formatDuration, percent } from '@/lib/format';
import { useI18n, useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useConfirm, usePrompt } from '@/components/ui/Confirm';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { EmptyState, PageHeader, Progress, Skeleton, usageTone } from '@/components/ui/Misc';
import { Tabs } from '@/components/ui/Tabs';
import { IconMedia, IconUpload } from '@/components/ui/icons';
import { MediaThumb } from '@/components/media/MediaThumb';
import { UploadList, useMediaUpload } from '@/components/media/useMediaUpload';

type Filter = 'all' | 'image' | 'video';

function UsageBar({ label, used, max, format }: { label: string; used: number; max: number; format: (n: number) => string }) {
  const pct = percent(used, max);
  return (
    <div className="min-w-0 flex-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</span>
        <span className="tabular-nums text-ink-2">
          {format(used)} / {format(max)}
        </span>
      </div>
      <Progress value={pct} tone={usageTone(pct)} className="mt-1.5" />
    </div>
  );
}

function Details({ item, onClose }: { item: MediaItem; onClose: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const { canEdit } = useRole();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const [blocked, setBlocked] = useState<MediaItem['usedBy'] | null>(null);

  const rename = useAction((name: string) => api(`/media/${item.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }), { invalidate: [['media']], success: 'Renamed' });
  const remove = useAction(() => api(`/media/${item.id}`, { method: 'DELETE' }), {
    invalidate: [['media'], ['organization']],
    success: 'File deleted',
    onSuccess: onClose,
  });

  async function askDelete() {
    const ok = await confirm({
      title: t('Delete file'),
      message: t('Delete "{name}" permanently?', { name: item.name }),
      confirmLabel: t('Delete'),
      danger: true,
    });
    if (!ok) return;
    try {
      await remove.mutateAsync();
    } catch (err) {
      // 409: still used by screens — show which ones instead of a bare error.
      if (err instanceof ApiError && err.code === 'MEDIA_IN_USE') setBlocked((err.body?.screens as MediaItem['usedBy']) ?? []);
    }
  }

  const rows: Array<[string, string]> = [
    [t('Type'), item.kind === 'video' ? t('Video') : t('Image')],
    [t('Size'), formatBytes(item.sizeBytes)],
    ...(item.width && item.height ? ([[t('Resolution'), `${item.width} × ${item.height}`]] as Array<[string, string]>) : []),
    ...(item.durationMs ? ([[t('Length'), formatDuration(item.durationMs / 1000)]] as Array<[string, string]>) : []),
    [t('Uploaded'), new Date(item.createdAt).toLocaleString(locale)],
  ];

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={item.name}
      footer={
        <>
          {canEdit && (
            <Button
              variant="ghost"
              onClick={async () => {
                const name = await prompt({ title: t('Rename file'), initial: item.name, label: t('Name'), confirmLabel: t('Rename'), validate: (v) => (v.trim() ? null : t('Enter a name')) });
                if (name) rename.mutate(name.trim());
              }}
            >
              {t('Rename')}
            </Button>
          )}
          {canEdit && (
            <Button variant="danger" loading={remove.isPending} onClick={askDelete}>
              {t('Delete')}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            {t('Close')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex max-h-[50dvh] items-center justify-center overflow-hidden rounded bg-sunken">
          {item.kind === 'video' ? (
            <video src={mediaUrl(item.id)} controls muted playsInline className="max-h-[50dvh] w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(item.id)} alt={item.name} className="max-h-[50dvh] max-w-full object-contain" />
          )}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {(blocked ?? item.usedBy).length > 0 && (
          <div className={cn('rounded border p-3 text-sm', blocked ? 'border-warn/40 bg-warn-soft' : 'border-line bg-sunken')}>
            <p className="font-medium">{blocked ? t('Still in use — remove it from these screens first:') : t('Used in')}</p>
            <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {(blocked ?? item.usedBy).map((s) => (
                <li key={s.id}>
                  <Link href={`/screens/${s.id}`} className="text-accent hover:underline">
                    {s.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}

export default function MediaPage() {
  const t = useT();
  const { canEdit } = useRole();
  const media = useMedia();
  const org = useOrganization();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const upload = useMediaUpload({ origin: 'library', crop: 'single' });

  const all = useMemo(() => media.data ?? [], [media.data]);
  const items = useMemo(
    () => all.filter((m) => (filter === 'all' || m.kind === filter) && (!query || m.name.toLowerCase().includes(query.toLowerCase()))),
    [all, filter, query],
  );
  const selected = all.find((m) => m.id === open) ?? null;
  const limits = org.data?.limits;
  const usage = org.data?.usage;

  return (
    <div
      className="relative space-y-8"
      onDragOver={(e) => {
        if (!canEdit || !e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDragging(false);
        upload.handleFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <PageHeader
        eyebrow={t('Manage')}
        title={t('Media')}
        description={t('Your uploads: pictures and videos for slideshows, banners and badges. Anything you add inside a screen lands here too.')}
        actions={
          canEdit && (
            <Button onClick={upload.open}>
              <IconUpload className="h-4 w-4" /> {t('Upload')}
            </Button>
          )
        }
      />
      {upload.host}

      {limits && usage && (
        <div className="grid gap-5 border-b border-line pb-6 sm:grid-cols-2 sm:gap-8">
          <UsageBar label={t('Files')} used={usage.mediaFiles} max={limits.maxMediaFiles} format={(n) => String(n)} />
          <UsageBar label={t('Storage')} used={usage.storageBytes} max={limits.storageQuotaMb * 1024 * 1024} format={formatBytes} />
        </div>
      )}

      <UploadList uploads={upload.uploads} onDismiss={upload.dismiss} />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs<Filter>
            className="border-0"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('All'), count: all.length },
              { value: 'image', label: t('Images'), count: all.filter((m) => m.kind === 'image').length },
              { value: 'video', label: t('Videos'), count: all.filter((m) => m.kind === 'video').length },
            ]}
          />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Search uploads')} className="sm:max-w-xs" />
        </div>

        {media.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }, (_, i) => (
              <Skeleton key={i} className="aspect-square" />
            ))}
          </div>
        ) : all.length === 0 ? (
          <EmptyState
            icon={<IconMedia />}
            title={t('No uploads yet')}
            description={t('Drop pictures or videos anywhere on this page, or press Upload. JPEG, PNG, GIF, WebP, MP4 and WebM are supported.')}
            action={canEdit && <Button onClick={upload.open}>{t('Upload')}</Button>}
          />
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-3">{t('Nothing matches your search.')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => setOpen(m.id)} className="group block w-full text-left">
                  <div className="overflow-hidden rounded border border-line transition-colors group-hover:border-ink-3">
                    <MediaThumb asset={m} />
                  </div>
                  <p className="mt-2 truncate text-sm font-medium">{m.name}</p>
                  <p className="flex items-center gap-2 text-xs text-ink-3">
                    <span className="tabular-nums">{formatBytes(m.sizeBytes)}</span>
                    {m.usedBy.length > 0 && <Badge tone="accent">{t('in use')}</Badge>}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-accent/10 p-6 backdrop-blur-[1px]">
          <div className="rounded-md border-2 border-dashed border-accent bg-surface px-10 py-8 text-lg font-medium shadow-xl">{t('Drop to upload')}</div>
        </div>
      )}

      {selected && <Details item={selected} onClose={() => setOpen(null)} />}
    </div>
  );
}
