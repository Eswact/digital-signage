'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, Orientation, Screen, TemplateType } from '@/lib/api';
import { useRole } from '@/lib/session';
import { useDevices, useScreens, useTemplates } from '@/lib/queries';
import { useAction } from '@/lib/hooks';
import { ORIENTATION_LABEL, ORIENTATION_OPTIONS, TEMPLATE_META, TEMPLATE_ORDER } from '@/lib/labels';
import { msg, useT } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Input';
import { EmptyState, PageHeader, Skeleton } from '@/components/ui/Misc';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { IconPlus, IconScreensEmpty } from '@/components/ui/icons';
import { ScreenThumb } from '@/components/previews/ScreenPreview';

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const templates = useTemplates();
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<TemplateType>('media-player');
  const [orientation, setOrientation] = useState<Orientation>('landscape');

  const create = useAction(
    () => {
      const def = templates.data?.find((d) => d.type === template);
      return api<Screen>('/screens', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), template, orientation, data: def?.defaultData ?? {} }),
      });
    },
    {
      invalidate: [['screens'], ['organization']],
      success: 'Screen created',
      onSuccess: (screen) => {
        setName('');
        onClose();
        router.push(`/screens/${screen.id}`);
      },
    },
  );

  // Only offer templates this server knows about (older backends may lack the newest).
  const available = TEMPLATE_ORDER.filter((type) => !templates.data || templates.data.some((d) => d.type === type));

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={t('New screen')}
      description={t('Pick a template, then edit its content. You can assign the screen to devices afterwards.')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button loading={create.isPending} disabled={!name.trim()} onClick={() => create.mutate()}>
            {t('Create screen')}
          </Button>
        </>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <Field label={t('Screen name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Lobby announcements')} autoFocus />
        </Field>

        <div className="space-y-1.5">
          <p className="text-[13px] font-medium">{t('Template')}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {available.map((type) => {
              const meta = TEMPLATE_META[type];
              const Icon = meta.icon;
              const on = template === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTemplate(type)}
                  aria-pressed={on}
                  className={cn(
                    'flex items-start gap-3 rounded border p-3 text-left transition-colors',
                    on ? 'border-accent bg-accent-soft/60 ring-1 ring-accent' : 'border-line-strong hover:border-ink-3',
                  )}
                >
                  <Icon className={cn('mt-0.5 h-5 w-5 flex-shrink-0', on ? 'text-accent' : 'text-ink-3')} />
                  <span>
                    <span className="block text-sm font-medium">{t(meta.name)}</span>
                    <span className="block text-xs text-ink-2">{t(meta.description)}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <Field label={t('Orientation')} hint={orientation === 'auto' ? t('Adaptive: the orientation is not locked; the layout follows the device as it rotates.') : undefined}>
          <SegmentedControl<Orientation> value={orientation} onChange={setOrientation} options={ORIENTATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.label) }))} />
        </Field>
      </form>
    </Dialog>
  );
}

export default function ScreensPage() {
  const t = useT();
  const { canEdit } = useRole();
  const screens = useScreens();
  const devices = useDevices();
  const [creating, setCreating] = useState(false);

  const list = screens.data ?? [];
  const deviceCount = (id: string) => (devices.data ?? []).filter((d) => d.currentScreenId === id).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={t('Manage')}
        title={t('Screens')}
        description={t('What your devices show. Build one from a template, then assign it to devices, groups or a schedule.')}
        actions={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              <IconPlus className="h-4 w-4" /> {t('New screen')}
            </Button>
          )
        }
      />

      {screens.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-60" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<IconScreensEmpty />}
          title={t('No screens yet')}
          description={t('Create your first screen from a template.')}
          action={canEdit && <Button onClick={() => setCreating(true)}>{t('New screen')}</Button>}
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const meta = TEMPLATE_META[s.template];
            const count = deviceCount(s.id);
            return (
              <li key={s.id}>
                <Link
                  href={`/screens/${s.id}`}
                  className="group block overflow-hidden rounded-md border border-line bg-surface transition-colors hover:border-ink-3"
                >
                  <ScreenThumb screen={s} />
                  <div className="flex items-start justify-between gap-3 border-t border-line p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium group-hover:text-accent">{s.name}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-3">{meta ? t(meta.name) : s.template}</p>
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-end gap-1">
                      <Badge>{t(ORIENTATION_LABEL[s.orientation])}</Badge>
                      {count > 0 && <span className="text-xs text-ink-3">{t(count === 1 ? msg('{n} device') : msg('{n} devices'), { n: count })}</span>}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <CreateDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}
