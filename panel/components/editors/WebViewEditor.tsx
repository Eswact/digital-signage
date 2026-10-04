'use client';

import { useState } from 'react';
import { Orientation, WebViewData } from '@/lib/api';
import { DraftUpdate } from '@/lib/useScreenDraft';
import { useRole } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { Card, CardBody } from '@/components/ui/Card';
import { Field, Input, NumberInput } from '@/components/ui/Input';
import { StudioLayout } from '@/components/studio/StudioLayout';
import { WebViewPreview } from '@/components/previews/WebViewPreview';

const isValidUrl = (value: string) => {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

export function WebViewEditor({ orientation, draft, update }: { orientation: Orientation; draft: WebViewData; update: DraftUpdate<WebViewData> }) {
  const t = useT();
  const { canEdit } = useRole();
  const [selected, setSelected] = useState<string | null>(null);
  // Local text so half-typed addresses do not get saved (or rejected by the server).
  const [url, setUrl] = useState(draft.url ?? '');
  const invalid = url.trim() !== '' && !isValidUrl(url.trim());

  const content = (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-4">
          <Field
            label={t('Web address')}
            error={invalid ? t('Enter a full address starting with http:// or https://') : null}
            hint={t('The device opens this page full screen.')}
          >
            <Input
              type="url"
              value={url}
              disabled={!canEdit}
              placeholder="https://example.com/board"
              onChange={(e) => {
                setUrl(e.target.value);
                const v = e.target.value.trim();
                if (v === '' || isValidUrl(v)) update({ url: v });
              }}
            />
          </Field>
          <Field label={t('Reload every (seconds)')} hint={t('0 = never. Useful for dashboards that do not refresh themselves.')}>
            <div className="w-28">
              <NumberInput value={draft.reloadSeconds ?? 0} min={0} max={86400} disabled={!canEdit} onChange={(n) => update({ reloadSeconds: Math.round(n) })} />
            </div>
          </Field>
        </CardBody>
      </Card>
      <p className="rounded border border-line bg-sunken p-3 text-xs text-ink-2">
        {t('Web pages need an internet connection: without one the device keeps showing the page it has loaded. Some sites refuse to be shown inside the panel preview; they still work on the device.')}
      </p>
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
      preview={<WebViewPreview data={draft} />}
      selected={selected}
      onSelect={setSelected}
      inspector={null}
    />
  );
}
