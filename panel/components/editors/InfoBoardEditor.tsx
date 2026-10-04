'use client';

import { useEffect, useRef, useState } from 'react';
import { BlockKind, BulletStyle, InfoBlock, InfoBoardData, Orientation } from '@/lib/api';
import { BLOCK_DEFAULTS, resolvePalette } from '@/lib/design';
import { DraftUpdate } from '@/lib/useScreenDraft';
import { useRole } from '@/lib/session';
import { useT, msg } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Button, IconButton } from '@/components/ui/Button';
import { Card, CardBody } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/Misc';
import { Field, Input, Label, NumberInput, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { StyleInspector } from '@/components/studio/StyleInspector';
import { InfoBoardPreview, blockKey } from '@/components/previews/InfoBoardPreview';
import { IconDown, IconPlus, IconTrash, IconUp, IconX } from '@/components/ui/icons';

const KIND_LABEL: Record<BlockKind, string> = { text: msg('Text'), list: msg('List') };

const BULLETS: { value: BulletStyle; label: string }[] = [
  { value: 'dot', label: msg('• Dot') },
  { value: 'dash', label: msg('– Dash') },
  { value: 'number', label: msg('1. Number') },
  { value: 'check', label: msg('✓ Check') },
  { value: 'none', label: msg('No marker') },
];

function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `b_${crypto.randomUUID().slice(0, 8)}`;
  return `b_${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export function InfoBoardEditor({
  orientation,
  draft,
  update,
}: {
  orientation: Orientation;
  draft: InfoBoardData;
  update: DraftUpdate<InfoBoardData>;
}) {
  const t = useT();
  const { canEdit } = useRole();
  const [selected, setSelected] = useState<string | null>(null);
  const blocks = draft.blocks ?? [];
  const cardRefs = useRef(new Map<string, HTMLDivElement>());

  // Bring the card of the block selected in the preview into view.
  useEffect(() => {
    if (!selected?.startsWith('block:')) return;
    cardRefs.current.get(selected.slice('block:'.length))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selected]);

  function editBlock(id: string, patch: Partial<InfoBlock>) {
    update((prev) => ({ blocks: (prev.blocks ?? []).map((b) => (b.id === id ? { ...b, ...patch } : b)) }));
  }

  function addBlock(kind: BlockKind) {
    const block: InfoBlock =
      kind === 'list'
        ? { id: uid(), kind, items: [t('New item')], bullet: 'dot', x: 10, y: 40, w: 80 }
        : { id: uid(), kind, text: t('New text'), x: 10, y: 40, w: 80 };
    update({ blocks: [...blocks, block] });
    setSelected(blockKey(block.id));
  }

  function removeBlock(id: string) {
    update({ blocks: blocks.filter((b) => b.id !== id) });
    if (selected === blockKey(id)) setSelected(null);
  }

  /** Layer order: blocks later in the list are drawn on top. */
  function moveLayer(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    update({ blocks: next });
  }

  const content = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <Label>{t('Blocks')}</Label>
          <p className="text-xs text-ink-3">{t('Drag blocks in the preview to place them, pull the right edge to widen.')}</p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => addBlock('text')}>
              <IconPlus className="h-4 w-4" /> {t('Text')}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => addBlock('list')}>
              <IconPlus className="h-4 w-4" /> {t('List')}
            </Button>
          </div>
        )}
      </div>

      {blocks.map((b, index) => {
        const active = selected === blockKey(b.id);
        const items = b.items ?? [];
        return (
          <div
            key={b.id}
            ref={(el) => {
              if (el) cardRefs.current.set(b.id, el);
              else cardRefs.current.delete(b.id);
            }}
            onClick={() => setSelected(blockKey(b.id))}
          >
            <Card className={cn(active && 'border-accent ring-2 ring-accent/20')}>
              <CardBody className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-2">{t(KIND_LABEL[b.kind])}</span>
                  {canEdit && (
                    <div className="flex items-center">
                      <IconButton size="sm" disabled={index === 0} onClick={() => moveLayer(b.id, -1)} title={t('Send backward')} aria-label={t('Send backward')}>
                        <IconDown className="h-4 w-4" />
                      </IconButton>
                      <IconButton size="sm" disabled={index === blocks.length - 1} onClick={() => moveLayer(b.id, 1)} title={t('Bring forward')} aria-label={t('Bring forward')}>
                        <IconUp className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBlock(b.id);
                        }}
                        aria-label={t('Delete block')}
                      >
                        <IconTrash className="h-4 w-4" />
                      </IconButton>
                    </div>
                  )}
                </div>

                {b.kind === 'text' ? (
                  <Textarea
                    rows={3}
                    value={b.text ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => editBlock(b.id, { text: e.target.value })}
                    placeholder={t('Text (can span several lines)')}
                  />
                ) : (
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={item}
                          disabled={!canEdit}
                          onChange={(e) => {
                            const next = [...items];
                            next[i] = e.target.value;
                            editBlock(b.id, { items: next });
                          }}
                        />
                        {canEdit && (
                          <IconButton aria-label={t('Delete item')} onClick={() => editBlock(b.id, { items: items.filter((_, j) => j !== i) })}>
                            <IconX className="h-4 w-4" />
                          </IconButton>
                        )}
                      </div>
                    ))}
                    {canEdit && (
                      <Button variant="ghost" size="sm" onClick={() => editBlock(b.id, { items: [...items, ''] })} className="w-full border border-dashed border-line-strong">
                        <IconPlus className="h-4 w-4" /> {t('Add item')}
                      </Button>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        );
      })}

      {blocks.length === 0 && (
        <EmptyState title={t('No blocks yet')} description={t('Add a text or list block to start.')} />
      )}
    </div>
  );

  const selectedBlock = blocks.find((b) => blockKey(b.id) === selected);

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
      preview={<InfoBoardPreview data={draft} onBlockChange={canEdit ? editBlock : undefined} />}
      selected={selected}
      onSelect={setSelected}
      inspector={
        selectedBlock && (
          <StyleInspector
            title={t('{kind} block', { kind: t(KIND_LABEL[selectedBlock.kind]) })}
            defaults={BLOCK_DEFAULTS}
            value={selectedBlock.style}
            palette={resolvePalette(draft.appearance)}
            onChange={(style) => editBlock(selectedBlock.id, { style })}
            onClose={() => setSelected(null)}
          >
            <div className="grid grid-cols-3 gap-2">
              <Field label={t('Left (%)')}>
                <NumberInput value={selectedBlock.x} min={0} max={100 - selectedBlock.w} step={0.5} onChange={(x) => editBlock(selectedBlock.id, { x })} />
              </Field>
              <Field label={t('Top (%)')}>
                <NumberInput value={selectedBlock.y} min={0} max={98} step={0.5} onChange={(y) => editBlock(selectedBlock.id, { y })} />
              </Field>
              <Field label={t('Width (%)')}>
                <NumberInput value={selectedBlock.w} min={5} max={100 - selectedBlock.x} step={0.5} onChange={(w) => editBlock(selectedBlock.id, { w })} />
              </Field>
            </div>
            {selectedBlock.kind === 'list' && (
              <Field label={t('Bullet')}>
                <Select value={selectedBlock.bullet ?? 'dot'} onChange={(e) => editBlock(selectedBlock.id, { bullet: e.target.value as BulletStyle })}>
                  {BULLETS.map((b) => (
                    <option key={b.value} value={b.value}>
                      {t(b.label)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </StyleInspector>
        )
      }
    />
  );
}
