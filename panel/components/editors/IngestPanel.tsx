'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, API_BASE, ApiKey, CreatedApiKey, OrderColumn, TemplateType } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Card';
import { Field, Input, Label } from '@/components/ui/Input';
import { IconCopy } from '@/components/ui/icons';

function CopyButton({ text }: { text: string }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      <IconCopy className="h-4 w-4" />
      {copied ? t('Copied') : t('Copy')}
    </Button>
  );
}

/** Example request + endpoint list for the template. */
function usage(template: TemplateType, key: string, columns: OrderColumn[], t: (s: string) => string) {
  const head = `-H "X-API-Key: ${key}"`;
  if (template === 'queue-number') {
    return {
      intro: t('An external system (queue machine, till, booking) can manage this screen\'s queue number and waiting list with an API key. Changes reach the device instantly.'),
      example: `# Call the next one (adds 1 to the number when the list is empty)
curl -X POST ${API_BASE}/ingest/queue/next ${head}

# Add to the waiting list (number is generated when omitted)
curl -X POST ${API_BASE}/ingest/queue/items ${head} \\
  -H "Content-Type: application/json" \\
  -d '{"number":"A042","name":"Jane D."}'`,
      endpoints: [
        'POST /ingest/queue/next',
        'POST /ingest/queue/prev',
        'PUT /ingest/queue/current {number, name?}',
        'POST /ingest/queue/items {number?, name?, id?}',
        'PATCH /ingest/queue/items/:id',
        'DELETE /ingest/queue/items/:id',
        'POST /ingest/queue/items/:id/call',
        'PUT /ingest/queue/items {items: [...]}',
        'GET /ingest/state',
      ],
    };
  }
  const col = columns[0]?.id ?? 'prep';
  return {
    intro: t('An external system (POS/till) can send orders to this screen with an API key. Changes reach the device instantly.'),
    example: `curl -X POST ${API_BASE}/ingest/orders ${head} \\
  -H "Content-Type: application/json" \\
  -d '{"code":"42","label":"Latte","columnId":"${col}"}'`,
    endpoints: ['POST /ingest/orders', 'PATCH /ingest/orders/:id', 'DELETE /ingest/orders/:id', 'PUT /ingest/orders {orders: [...]}', 'GET /ingest/state'],
  };
}

/** "Feed via API": scoped keys for the screen, shown once on creation, plus copy-paste examples. */
export function IngestPanel({ screenId, template, columns = [] }: { screenId: string; template: TemplateType; columns?: OrderColumn[] }) {
  const t = useT();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  // The raw key only comes back in the create response; the server never stores it.
  const [created, setCreated] = useState<CreatedApiKey | null>(null);

  const keys = useQuery({ queryKey: ['keys', screenId], queryFn: () => api<ApiKey[]>(`/screens/${screenId}/keys`) });

  const create = useAction(() => api<CreatedApiKey>(`/screens/${screenId}/keys`, { method: 'POST', body: JSON.stringify({ name: name.trim() || 'POS' }) }), {
    onSuccess: (key) => {
      setCreated(key);
      setName('');
      qc.invalidateQueries({ queryKey: ['keys', screenId] });
    },
  });

  const revoke = useAction((keyId: string) => api(`/screens/${screenId}/keys/${keyId}`, { method: 'DELETE' }), {
    success: 'Key revoked',
    onSuccess: (_r, keyId) => {
      if (created?.id === keyId) setCreated(null);
      qc.invalidateQueries({ queryKey: ['keys', screenId] });
    },
  });

  const list = keys.data ?? [];
  const { intro, example, endpoints } = usage(template, created?.key ?? 'sk_YOUR_KEY', columns, t);

  return (
    <Section title={t('Feed via API')} description={intro}>
      <div className="space-y-5">
        <div className="flex items-end gap-2">
          <Field label={t('New key name')} className="flex-1">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Till-1')} />
          </Field>
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            {t('Create')}
          </Button>
        </div>

        {created && (
          <div className="space-y-2 rounded border border-warn/40 bg-warn-soft p-3">
            <p className="text-sm font-medium text-warn">{t('Copy the key "{name}" now — for security it will not be shown again.', { name: created.name })}</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1.5 font-mono text-xs ring-1 ring-warn/30">{created.key}</code>
              <CopyButton text={created.key} />
              <Button variant="ghost" size="sm" onClick={() => setCreated(null)}>
                {t('Done')}
              </Button>
            </div>
          </div>
        )}

        {list.length > 0 && (
          <div className="space-y-2">
            {list.map((k) => (
              <div key={k.id} className="flex items-center gap-2 rounded border border-line bg-sunken p-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{k.name}</div>
                  <div className="truncate font-mono text-xs text-ink-2">
                    {k.prefix}…
                    {k.lastUsedAt && <span className="ml-2 font-sans text-ink-3">{t('last used {when}', { when: new Date(k.lastUsedAt).toLocaleString() })}</span>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" loading={revoke.isPending && revoke.variables === k.id} onClick={() => revoke.mutate(k.id)}>
                  {t('Revoke')}
                </Button>
              </div>
            ))}
          </div>
        )}

        {columns.length > 0 && (
          <div className="space-y-1.5">
            <Label>{t('Column codes (columnId)')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {columns.map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 rounded border border-line bg-sunken px-2 py-1 text-xs">
                  <code className="font-mono text-accent">{c.id}</code>
                  <span className="text-ink-3">{c.title}</span>
                </span>
              ))}
            </div>
            <p className="text-xs text-ink-3">{t('Your POS uses these codes as columnId (you can change them above).')}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label>{t('Example')}</Label>
          <pre className="overflow-x-auto rounded bg-[#111] p-3 text-xs leading-relaxed text-[#f2f2ee]">{example}</pre>
          <p className="text-xs leading-relaxed text-ink-3">
            {t('Endpoints')}:{' '}
            {endpoints.map((e, i) => (
              <span key={e}>
                {i > 0 && ' · '}
                <code>{e}</code>
              </span>
            ))}
            . {t('All of them need the X-API-Key header.')}
          </p>
        </div>
      </div>
    </Section>
  );
}
