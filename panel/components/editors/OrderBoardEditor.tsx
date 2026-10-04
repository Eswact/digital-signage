'use client';

import { useState } from 'react';
import { OrderBoardData, OrderColumn, OrderItem, Orientation } from '@/lib/api';
import { ORDER_BOARD_ELEMENTS, resolvePalette } from '@/lib/design';
import { DraftUpdate } from '@/lib/useScreenDraft';
import { useRole } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Misc';
import { Field, Input, Label, NumberInput } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Toggle } from '@/components/ui/Toggle';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { ElementInspector } from '@/components/studio/StyleInspector';
import { OrderBoardPreview } from '@/components/previews/OrderBoardPreview';
import { IngestPanel } from '@/components/editors/IngestPanel';
import { IconPlus, IconX } from '@/components/ui/icons';

const ACCENTS = ['#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#a855f7', '#14b8a6'];

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.floor(Math.random() * 1e9).toString(36);
}

const FOLD: Record<string, string> = { İ: 'i', I: 'i', ı: 'i', Ş: 's', ş: 's', Ğ: 'g', ğ: 'g', Ü: 'u', ü: 'u', Ö: 'o', ö: 'o', Ç: 'c', ç: 'c' };

/** "Cancelled order" → "cancelled-order": a stable, readable code for the POS to use. */
function slugId(s: string): string {
  return s
    .replace(/[İIıŞşĞğÜüÖöÇç]/g, (m) => FOLD[m] ?? m)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Unique, readable default code for a new column. */
function defaultColumnId(columns: OrderColumn[]): string {
  const ids = new Set(columns.map((c) => c.id));
  let n = columns.length + 1;
  while (ids.has(`column-${n}`)) n++;
  return `column-${n}`;
}

export function OrderBoardEditor({
  screenId,
  orientation,
  draft,
  update,
}: {
  screenId: string;
  orientation: Orientation;
  draft: OrderBoardData;
  update: DraftUpdate<OrderBoardData>;
}) {
  const t = useT();
  const { canEdit } = useRole();
  const [selected, setSelected] = useState<string | null>(null);
  const columns = draft.columns ?? [];
  const orders = draft.orders ?? [];
  const showLabel = draft.showLabel ?? true;

  // Column code (id) edit buffer — applied on blur.
  const [editingCode, setEditingCode] = useState<{ id: string; value: string } | null>(null);

  function addColumn() {
    const col: OrderColumn = { id: defaultColumnId(columns), title: t('New column'), accent: ACCENTS[columns.length % ACCENTS.length] };
    update({ columns: [...columns, col] });
  }
  function editColumn(id: string, patch: Partial<OrderColumn>) {
    update({ columns: columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }
  /** Changes a column code (id) and moves the column's orders along. */
  function changeColumnId(oldId: string, raw: string) {
    setEditingCode(null);
    const newId = slugId(raw);
    // Empty or colliding with another column → keep the old code.
    if (!newId || newId === oldId || columns.some((c) => c.id === newId)) return;
    update({
      columns: columns.map((c) => (c.id === oldId ? { ...c, id: newId } : c)),
      orders: orders.map((o) => (o.columnId === oldId ? { ...o, columnId: newId } : o)),
    });
  }
  function removeColumn(id: string) {
    update({ columns: columns.filter((c) => c.id !== id), orders: orders.filter((o) => o.columnId !== id) });
  }

  function addOrder(columnId: string) {
    const order: OrderItem = { id: uid(), code: '', label: '', columnId };
    update({ orders: [...orders, order] });
  }
  function editOrder(id: string, patch: Partial<OrderItem>) {
    update({ orders: orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  }
  function removeOrder(id: string) {
    update({ orders: orders.filter((o) => o.id !== id) });
  }

  const content = (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <Field label={t('Board title')}>
            <Input value={draft.title ?? ''} disabled={!canEdit} onChange={(e) => update({ title: e.target.value })} placeholder={t('e.g. Orders')} />
          </Field>
          <Toggle checked={showLabel} disabled={!canEdit} onChange={(v) => update({ showLabel: v })} label={t('Show label (name/product under the number)')} />
          <Toggle checked={draft.showClock ?? true} disabled={!canEdit} onChange={(v) => update({ showClock: v })} label={t('Show clock')} />
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <span>{t('When orders do not fit, turn the page every')}</span>
            <div className="w-16 flex-none">
              <NumberInput
                value={draft.pageSeconds ?? 8}
                min={3}
                max={60}
                disabled={!canEdit}
                onChange={(n) => update({ pageSeconds: Math.round(n) })}
                className="h-9 text-center"
              />
            </div>
            <span>{t('seconds')}</span>
          </div>
        </CardBody>
      </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{t('Columns')}</Label>
          {canEdit && (
            <Button variant="secondary" size="sm" onClick={addColumn}>
              <IconPlus className="h-4 w-4" /> {t('Column')}
            </Button>
          )}
        </div>

        {columns.map((col) => {
          const items = orders.filter((o) => o.columnId === col.id);
          return (
            <Card key={col.id}>
              <CardBody className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={col.accent ?? '#3f3f46'}
                    disabled={!canEdit}
                    onChange={(e) => editColumn(col.id, { accent: e.target.value })}
                    className="h-9 w-9 cursor-pointer rounded border border-line-strong bg-surface p-0.5"
                    title={t('Column color')}
                    aria-label={t('Column color')}
                  />
                  <Input value={col.title} disabled={!canEdit} onChange={(e) => editColumn(col.id, { title: e.target.value })} className="flex-1" />
                  {canEdit && (
                    <Button variant="danger" size="sm" onClick={() => removeColumn(col.id)}>
                      {t('Delete')}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="w-8 text-center text-[10px] uppercase tracking-wide text-ink-3">{t('code')}</span>
                  <input
                    value={editingCode?.id === col.id ? editingCode.value : col.id}
                    disabled={!canEdit}
                    onFocus={() => setEditingCode({ id: col.id, value: col.id })}
                    onChange={(e) => setEditingCode({ id: col.id, value: e.target.value })}
                    onBlur={() => editingCode?.id === col.id && changeColumnId(col.id, editingCode.value)}
                    className="h-8 flex-1 rounded border border-line-strong bg-surface px-2 font-mono text-xs text-ink-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    title={t('Fixed code your POS sends as columnId, e.g. cancelled, ready')}
                  />
                </div>

                <div className="space-y-2">
                  {items.map((o) => (
                    <div key={o.id} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                      <div className="w-20 flex-none">
                        <Input value={o.code} disabled={!canEdit} onChange={(e) => editOrder(o.id, { code: e.target.value })} placeholder={t('No.')} className="text-center font-mono" />
                      </div>
                      <div className="min-w-0 flex-1">
                        {showLabel && (
                          <Input value={o.label ?? ''} disabled={!canEdit} onChange={(e) => editOrder(o.id, { label: e.target.value })} placeholder={t('Label (optional)')} />
                        )}
                      </div>
                      <div className="w-36 flex-none">
                        <Select value={o.columnId} disabled={!canEdit} onChange={(e) => editOrder(o.id, { columnId: e.target.value })} title={t('Move to column')}>
                          {columns.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.title}
                            </option>
                          ))}
                        </Select>
                      </div>
                      {canEdit && (
                        <IconButton onClick={() => removeOrder(o.id)} aria-label={t('Delete')}>
                          <IconX className="h-4 w-4" />
                        </IconButton>
                      )}
                    </div>
                  ))}

                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={() => addOrder(col.id)} className="w-full border border-dashed border-line-strong">
                      <IconPlus className="h-4 w-4" /> {t('Add order')}
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}

        {columns.length === 0 && <EmptyState title={t('No columns yet')} description={t('Add a column to start.')} />}
      </div>

      {canEdit && <IngestPanel screenId={screenId} template="order-board" columns={columns} />}
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
      preview={<OrderBoardPreview data={draft} />}
      selected={selected}
      onSelect={setSelected}
      inspector={
        selected && (
          <ElementInspector
            elements={ORDER_BOARD_ELEMENTS}
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
