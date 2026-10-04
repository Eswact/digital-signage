'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api,
  InfoBoardData,
  MediaPlayerData,
  OrderBoardData,
  Orientation,
  QueueData,
  Screen,
  WebViewData,
} from '@/lib/api';
import { useRole } from '@/lib/session';
import { useLive } from '@/lib/live';
import { useTemplates } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { DraftUpdate, SaveStatus, useScreenDraft } from '@/lib/useScreenDraft';
import { ORIENTATION_OPTIONS, TEMPLATE_META } from '@/lib/labels';
import { msg, useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { useConfirm, usePrompt } from '@/components/ui/Confirm';
import { Skeleton } from '@/components/ui/Misc';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { IconBack, IconEdit } from '@/components/ui/icons';
import { OrderBoardEditor } from '@/components/editors/OrderBoardEditor';
import { QueueNumberEditor } from '@/components/editors/QueueNumberEditor';
import { InfoBoardEditor } from '@/components/editors/InfoBoardEditor';
import { MediaPlayerEditor } from '@/components/editors/MediaPlayerEditor';
import { WebViewEditor } from '@/components/editors/WebViewEditor';

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: msg('Changes are saved automatically'),
  pending: msg('Saving soon…'),
  saving: msg('Saving…'),
  saved: msg('Saved · sent to devices'),
  error: msg('Could not save — keep editing to retry'),
};

export default function ScreenEditorPage() {
  const params = useParams<{ id: string }>();
  const live = useLive();

  const screen = useQuery({
    queryKey: ['screen', params.id],
    queryFn: () => api<Screen>(`/screens/${params.id}`),
    // Orders/queue stream in from outside (ingest): keep the editor in sync. While the live
    // stream is up it tells us when to refetch, so polling only covers the offline case.
    refetchInterval: (query) => {
      const template = query.state.data?.template;
      if (live.connected) return false;
      return template === 'order-board' || template === 'queue-number' ? 2500 : 15_000;
    },
  });

  if (screen.isError) {
    return <ScreenMissing />;
  }
  if (!screen.data) return <Skeleton className="h-96 w-full" />;
  return <ScreenEditor screen={screen.data} />;
}

function ScreenMissing() {
  const t = useT();
  return (
    <div className="space-y-3 py-10 text-center">
      <p className="font-medium">{t('This screen does not exist (anymore).')}</p>
      <Link href="/screens" className="text-sm text-accent hover:underline">
        {t('Back to screens')}
      </Link>
    </div>
  );
}

function ScreenEditor({ screen: s }: { screen: Screen }) {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const { canEdit } = useRole();
  const templates = useTemplates();

  // Only changed top-level keys are sent (merge), so live fields are never overwritten.
  const save = useCallback(
    async (merge: Record<string, unknown>) => {
      await qc.cancelQueries({ queryKey: ['screen', s.id] });
      const updated = await api<Screen>(`/screens/${s.id}`, { method: 'PATCH', body: JSON.stringify({ merge }) });
      qc.setQueryData(['screen', s.id], updated);
      qc.invalidateQueries({ queryKey: ['screens'] });
      qc.invalidateQueries({ queryKey: ['media'] }); // usage markers
    },
    [qc, s.id],
  );
  const { draft, update, status } = useScreenDraft<Record<string, unknown>>(s.data, save);

  const patchScreen = useAction((body: { name?: string; orientation?: Orientation }) => api<Screen>(`/screens/${s.id}`, { method: 'PATCH', body: JSON.stringify(body) }), {
    onSuccess: (updated) => {
      qc.setQueryData(['screen', s.id], updated);
      qc.invalidateQueries({ queryKey: ['screens'] });
    },
  });

  const remove = useAction(() => api(`/screens/${s.id}`, { method: 'DELETE' }), {
    invalidate: [['screens'], ['devices'], ['organization'], ['schedules'], ['media']],
    success: 'Screen deleted',
    onSuccess: () => router.replace('/screens'),
  });

  const meta = TEMPLATE_META[s.template];
  const orientation = patchScreen.isPending && patchScreen.variables?.orientation ? patchScreen.variables.orientation : s.orientation;
  const def = templates.data?.find((d) => d.type === s.template);

  const common = { orientation, draft, update };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/screens" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
            <IconBack className="h-4 w-4" /> {t('Screens')}
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="truncate text-[26px] font-semibold leading-tight tracking-tightest">{s.name}</h1>
            {canEdit && (
              <button
                type="button"
                aria-label={t('Rename screen')}
                onClick={async () => {
                  const name = await prompt({ title: t('Rename screen'), initial: s.name, label: t('Screen name'), confirmLabel: t('Rename'), validate: (v) => (v.trim() ? null : t('Enter a name')) });
                  if (name) patchScreen.mutate({ name: name.trim() });
                }}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-ink-3 hover:bg-sunken hover:text-ink"
              >
                <IconEdit className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-xs text-ink-3">
            {meta ? t(meta.name) : def?.label ?? s.template} ·{' '}
            <span className={cn(status === 'error' && 'text-danger')}>{canEdit ? t(STATUS_TEXT[status]) : t('View only')}</span>
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl<Orientation>
              value={orientation}
              onChange={(o) => o !== s.orientation && patchScreen.mutate({ orientation: o })}
              options={ORIENTATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))}
            />
            <Button
              variant="danger"
              size="sm"
              loading={remove.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: t('Delete screen'),
                  message: t('Delete "{name}" permanently? Devices showing it go back to their pairing screen, and its schedules are removed.', { name: s.name }),
                  confirmLabel: t('Delete'),
                  danger: true,
                });
                if (ok) remove.mutate();
              }}
            >
              {t('Delete')}
            </Button>
          </div>
        )}
      </div>

      {s.template === 'order-board' && <OrderBoardEditor screenId={s.id} {...common} draft={draft as unknown as OrderBoardData} update={update as unknown as DraftUpdate<OrderBoardData>} />}
      {s.template === 'queue-number' && <QueueNumberEditor screenId={s.id} {...common} draft={draft as unknown as QueueData} update={update as unknown as DraftUpdate<QueueData>} />}
      {s.template === 'info-board' && <InfoBoardEditor {...common} draft={draft as unknown as InfoBoardData} update={update as unknown as DraftUpdate<InfoBoardData>} />}
      {s.template === 'media-player' && <MediaPlayerEditor {...common} draft={draft as unknown as MediaPlayerData} update={update as unknown as DraftUpdate<MediaPlayerData>} />}
      {s.template === 'webview' && <WebViewEditor {...common} draft={draft as unknown as WebViewData} update={update as unknown as DraftUpdate<WebViewData>} />}
    </div>
  );
}
