'use client';

import {
  InfoBoardData,
  MediaPlayerData,
  OrderBoardData,
  Orientation,
  QueueData,
  Screen,
  Styled,
  WebViewData,
} from '@/lib/api';
import { resolvePalette } from '@/lib/design';
import { StageCanvas } from '@/components/studio/PreviewStage';
import { InfoBoardPreview } from '@/components/previews/InfoBoardPreview';
import { MediaPlayerPreview } from '@/components/previews/MediaPlayerPreview';
import { OrderBoardPreview } from '@/components/previews/OrderBoardPreview';
import { OverlayFrame } from '@/components/previews/OverlayFrame';
import { QueueNumberPreview } from '@/components/previews/QueueNumberPreview';
import { WebViewPreview } from '@/components/previews/WebViewPreview';

/** Static (non-interactive) render of a screen's template, used for thumbnails. */
export function TemplateStatic({ screen }: { screen: Pick<Screen, 'template' | 'data'> }) {
  const data = screen.data as unknown;
  switch (screen.template) {
    case 'order-board':
      return <OrderBoardPreview data={data as OrderBoardData} />;
    case 'queue-number':
      return <QueueNumberPreview data={data as QueueData} />;
    case 'info-board':
      return <InfoBoardPreview data={data as InfoBoardData} />;
    case 'media-player':
      return <MediaPlayerPreview data={data as MediaPlayerData} />;
    case 'webview':
      return <WebViewPreview data={data as WebViewData} thumbnail />;
    default:
      return null;
  }
}

const THUMB_RES: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1920, h: 1080 },
  portrait: { w: 1080, h: 1920 },
  auto: { w: 1920, h: 1080 },
};

/** Miniature of what a screen looks like on a device (banners and badges included). */
export function ScreenThumb({ screen }: { screen: Screen }) {
  const styled = screen.data as Styled;
  const palette = resolvePalette(styled.appearance);
  const res = THUMB_RES[screen.orientation];
  return (
    <div className="pointer-events-none flex justify-center bg-sunken p-3" aria-hidden>
      <StageCanvas res={res} maxWidth={res.h > res.w ? '42%' : '100%'}>
        <OverlayFrame overlays={styled.overlays} styles={styled.styles} palette={palette}>
          <TemplateStatic screen={screen} />
        </OverlayFrame>
      </StageCanvas>
    </div>
  );
}
