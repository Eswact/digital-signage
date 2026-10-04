'use client';

import { useState } from 'react';
import { api, Orientation, QueueData } from '@/lib/api';
import { QUEUE_ELEMENTS, resolvePalette } from '@/lib/design';
import { DraftUpdate } from '@/lib/useScreenDraft';
import { useAction } from '@/lib/hooks';
import { useRole } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, Input, Label, NumberInput } from '@/components/ui/Input';
import { Toggle } from '@/components/ui/Toggle';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { ElementInspector } from '@/components/studio/StyleInspector';
import { QueueNumberPreview } from '@/components/previews/QueueNumberPreview';
import { IngestPanel } from '@/components/editors/IngestPanel';
import { IconPlus, IconX } from '@/components/ui/icons';

interface QueueOp {
  path: string;
  method?: 'POST' | 'PUT' | 'DELETE';
  body?: Record<string, unknown>;
}

export function QueueNumberEditor({
  screenId,
  orientation,
  draft,
  update,
}: {
  screenId: string;
  orientation: Orientation;
  draft: QueueData;
  update: DraftUpdate<QueueData>;
}) {
  const t = useT();
  const { canEdit } = useRole();
  const [selected, setSelected] = useState<string | null>(null);
  const [setForm, setSetForm] = useState({ number: '', name: '' });
  const [addForm, setAddForm] = useState({ number: '', name: '' });

  // The number and list change on the server (same endpoints as the POS) → no races, nothing overwritten.
  const op = useAction(
    ({ path, method = 'POST', body }: QueueOp) =>
      api(`/screens/${screenId}/queue/${path}`, { method, body: body ? JSON.stringify(body) : undefined }),
    { invalidate: [['screen', screenId]] },
  );

  const queue = draft.queue ?? [];
  const busy = op.isPending || !canEdit;

  const content = (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <Label>{t('Current number')}</Label>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded bg-sunken p-4">
            <div className="min-w-0">
              <div className="truncate font-mono text-4xl font-bold tabular-nums">{draft.current || '—'}</div>
              {draft.currentName && <div className="truncate text-sm text-ink-2">{draft.currentName}</div>}
            </div>
            <div className="flex flex-shrink-0 gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => op.mutate({ path: 'prev' })}>
                {t('− Back')}
              </Button>
              <Button disabled={busy} onClick={() => op.mutate({ path: 'next' })}>
                {t('Next +')}
              </Button>
            </div>
          </div>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!setForm.number.trim()) return;
              op.mutate(
                { path: 'current', method: 'PUT', body: { number: setForm.number.trim(), name: setForm.name.trim() } },
                { onSuccess: () => setSetForm({ number: '', name: '' }) },
              );
            }}
          >
            <div className="w-40 flex-none">
              <Input value={setForm.number} onChange={(e) => setSetForm({ ...setForm, number: e.target.value })} placeholder={t('Number')} className="font-mono" disabled={!canEdit} />
            </div>
            <div className="min-w-[8rem] flex-1">
              <Input value={setForm.name} onChange={(e) => setSetForm({ ...setForm, name: e.target.value })} placeholder={t('Name (optional)')} disabled={!canEdit} />
            </div>
            <Button type="submit" variant="secondary" disabled={busy || !setForm.number.trim()}>
              {t('Set')}
            </Button>
          </form>
          <p className="text-xs text-ink-3">{t('"Next" calls the first entry in the list; with an empty list it adds one to the number (A042 → A043).')}</p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>{t('Up next')}</Label>
            <span className="text-xs text-ink-3">{t('{n} entries', { n: queue.length })}</span>
          </div>
          <Toggle checked={draft.showQueue ?? false} disabled={!canEdit} onChange={(v) => update({ showQueue: v })} label={t('Show the "up next" list on the screen')} />
          <Toggle checked={draft.showNames ?? true} disabled={!canEdit} onChange={(v) => update({ showNames: v })} label={t('Show names in the list')} />
          <div className="flex items-center gap-2 text-sm text-ink-2">
            <span>{t('Show at most')}</span>
            <div className="w-20 flex-none">
              <NumberInput value={draft.queueLimit ?? 5} min={1} max={20} disabled={!canEdit} onChange={(n) => update({ queueLimit: Math.round(n) })} className="h-9 text-center" />
            </div>
            <span>{t('entries')}</span>
          </div>

          <div className="space-y-2">
            {queue.map((item) => (
              <div key={item.id} className="flex items-center gap-2 rounded border border-line p-2">
                <span className="w-20 truncate text-center font-mono text-sm font-semibold">{item.number}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{item.name || <span className="text-ink-3">—</span>}</span>
                <Button variant="secondary" size="sm" disabled={busy} onClick={() => op.mutate({ path: `items/${item.id}/call` })}>
                  {t('Call')}
                </Button>
                <IconButton size="sm" aria-label={t('Delete')} disabled={busy} onClick={() => op.mutate({ path: `items/${item.id}`, method: 'DELETE' })}>
                  <IconX className="h-4 w-4" />
                </IconButton>
              </div>
            ))}
            <form
              className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
              onSubmit={(e) => {
                e.preventDefault();
                const body: Record<string, unknown> = { name: addForm.name.trim() };
                if (addForm.number.trim()) body.number = addForm.number.trim();
                op.mutate({ path: 'items', body }, { onSuccess: () => setAddForm({ number: '', name: '' }) });
              }}
            >
              <div className="w-32 flex-none">
                <Input value={addForm.number} onChange={(e) => setAddForm({ ...addForm, number: e.target.value })} placeholder={t('No. (auto)')} className="font-mono" disabled={!canEdit} />
              </div>
              <div className="min-w-0 flex-1">
                <Input value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder={t('Name (optional)')} disabled={!canEdit} />
              </div>
              <Button type="submit" variant="secondary" disabled={busy}>
                <IconPlus className="h-4 w-4" /> {t('Add')}
              </Button>
            </form>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-4">
          <Field label={t('Heading')}>
            <Input value={draft.heading ?? ''} disabled={!canEdit} onChange={(e) => update({ heading: e.target.value })} placeholder={t('e.g. Now serving')} />
          </Field>
          <Field label={t('Subtitle')}>
            <Input value={draft.subtitle ?? ''} disabled={!canEdit} onChange={(e) => update({ subtitle: e.target.value })} placeholder={t('e.g. Please go to the counter when your number is called')} />
          </Field>
          <Field label={t('List title')}>
            <Input value={draft.queueTitle ?? ''} disabled={!canEdit} onChange={(e) => update({ queueTitle: e.target.value })} placeholder={t('e.g. Up next')} />
          </Field>
        </CardBody>
      </Card>

      {canEdit && <IngestPanel screenId={screenId} template="queue-number" />}
    </div>
  );

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
      preview={<QueueNumberPreview data={draft} />}
      selected={selected}
      onSelect={setSelected}
      inspector={
        selected && (
          <ElementInspector
            elements={QUEUE_ELEMENTS}
            styles={draft.styles}
            palette={resolvePalette(draft.appearance)}
            selected={selected}
            onChange={(styles) => update({ styles })}
            onClose={() => setSelected(null)}
          />
        )
      }
    />
  );
}
