'use client';

import { QueueData } from '@/lib/api';
import {
  QUEUE_ELEMENTS,
  backgroundCss,
  elementCss,
  resolvePalette,
  u,
} from '@/lib/design';
import { Sel } from '@/components/studio/Selection';
import { useCanvas } from '@/components/studio/PreviewStage';

/**
 * Counterpart of Android QueueNumberTemplate: big current number (+ name) and an
 * optional "up next" list (on the right in landscape, below in portrait).
 */
export function QueueNumberPreview({ data }: { data: QueueData }) {
  const { portrait } = useCanvas();
  const palette = resolvePalette(data.appearance);
  const css = (key: string) => elementCss(QUEUE_ELEMENTS, key, data.styles, palette);
  const queue = (data.queue ?? []).slice(0, Math.max(1, data.queueLimit ?? 5));
  const showNames = data.showNames ?? true;

  return (
    <div
      className="flex h-full w-full"
      style={{
        background: backgroundCss(palette),
        padding: u(64),
        gap: u(48),
        flexDirection: portrait ? 'column' : 'row',
      }}
    >
      <div
        className="flex min-h-0 min-w-0 flex-col items-stretch justify-center overflow-hidden"
        style={{ flex: 3, gap: u(12) }}
      >
        {data.heading && (
          <Sel k="heading" style={css('heading')}>
            {data.heading}
          </Sel>
        )}
        <Sel k="number" className="whitespace-nowrap" style={css('number')}>
          {data.current || '—'}
        </Sel>
        {data.currentName && (
          <Sel k="currentName" style={css('currentName')}>
            {data.currentName}
          </Sel>
        )}
        {data.subtitle && (
          <Sel k="subtitle" style={css('subtitle')}>
            {data.subtitle}
          </Sel>
        )}
      </div>

      {data.showQueue && (
        <div
          className="flex min-h-0 min-w-0 flex-col overflow-hidden"
          style={{
            flex: 2,
            borderRadius: u(32),
            backgroundColor: palette.surface,
            padding: u(40),
            gap: u(20),
          }}
        >
          {data.queueTitle && (
            <Sel k="queueTitle" style={css('queueTitle')}>
              {data.queueTitle}
            </Sel>
          )}
          {queue.length === 0 ? (
            <div
              className="flex flex-1 items-center justify-center"
              style={{ color: palette.muted, fontSize: u(48) }}
            >
              —
            </div>
          ) : (
            queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center overflow-hidden"
                style={{
                  borderRadius: u(20),
                  backgroundColor: palette.card,
                  padding: `${u(20)} ${u(28)}`,
                  gap: u(24),
                }}
              >
                <Sel k="queueNumber" className="whitespace-nowrap" style={css('queueNumber')}>
                  {item.number}
                </Sel>
                {showNames && item.name && (
                  <Sel k="queueName" className="min-w-0 flex-1 truncate" style={css('queueName')}>
                    {item.name}
                  </Sel>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
