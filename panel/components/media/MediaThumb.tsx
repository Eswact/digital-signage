'use client';

import { MediaItem, mediaUrl } from '@/lib/api';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/cn';
import { IconVideo } from '@/components/ui/icons';

/** Square-cropped thumbnail of a library file (first frame for videos) with a duration tag. */
export function MediaThumb({
  asset,
  className,
}: {
  asset: Pick<MediaItem, 'id' | 'kind' | 'durationMs'> & { name?: string };
  className?: string;
}) {
  const src = mediaUrl(asset.id);
  return (
    <div className={cn('relative aspect-square w-full overflow-hidden bg-sunken', className)}>
      {asset.kind === 'video' ? (
        <>
          <video src={`${src}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
          <span className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-sm bg-black/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white">
            <IconVideo className="h-3 w-3" />
            {asset.durationMs ? formatDuration(asset.durationMs / 1000) : 'video'}
          </span>
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={asset.name ?? ''} loading="lazy" draggable={false} className="h-full w-full object-cover" />
      )}
    </div>
  );
}
