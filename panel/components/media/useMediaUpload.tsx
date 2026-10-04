'use client';

import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MediaItem } from '@/lib/api';
import { processImage, uploadMedia, videoDuration, CropRect } from '@/lib/media';
import { formatBytes } from '@/lib/format';
import { useOrganization } from '@/lib/queries';
import { useRole } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { CropDialog } from '@/components/media/CropDialog';
import { Progress } from '@/components/ui/Misc';
import { IconCheck, IconWarning, IconX } from '@/components/ui/icons';
import { cn } from '@/lib/cn';

export interface UploadItem {
  id: number;
  name: string;
  progress: number;
  status: 'uploading' | 'done' | 'error';
  error?: string;
}

type CropMode = 'never' | 'single' | 'always';

/**
 * Picking → (crop) → upload flow shared by the Uploads page, the screen editors and
 * the banner/badge inspector. Render `host` once somewhere in the component.
 *  - crop 'single': one picked image opens the crop dialog; several upload straight away.
 *  - crop 'always': every image goes through the crop dialog (banners, badges).
 */
export function useMediaUpload({
  origin,
  crop = 'single',
  initialAspect,
  accept = 'image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm',
  multiple = true,
  onUploaded,
}: {
  origin: 'library' | 'screen' | 'overlay';
  crop?: CropMode;
  initialAspect?: 'free' | '16:9' | '9:16' | '4:3' | '1:1' | '32:9' | '9:32';
  accept?: string;
  multiple?: boolean;
  onUploaded?: (asset: MediaItem, duplicate: boolean) => void;
}) {
  const t = useT();
  const qc = useQueryClient();
  const { isSuperadmin } = useRole();
  const org = useOrganization();
  const input = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [cropQueue, setCropQueue] = useState<File[]>([]);

  const patch = useCallback((id: number, change: Partial<UploadItem>) => {
    setUploads((list) => list.map((u) => (u.id === id ? { ...u, ...change } : u)));
  }, []);
  const dismiss = useCallback((id: number) => setUploads((list) => list.filter((u) => u.id !== id)), []);

  const run = useCallback(
    async (file: File, cropRect?: CropRect) => {
      const id = nextId.current++;
      setUploads((list) => [...list, { id, name: file.name, progress: 0, status: 'uploading' }]);
      try {
        const limits = org.data?.limits;
        let blob: Blob = file;
        let filename = file.name;
        let avgColor: string | null = null;

        if (file.type.startsWith('image/')) {
          const processed = await processImage(file, cropRect);
          blob = processed.blob;
          filename = processed.filename;
          avgColor = processed.avgColor;
        } else if (file.type.startsWith('video/') && !isSuperadmin && limits) {
          const seconds = await videoDuration(file);
          if (seconds != null && seconds > limits.maxVideoSeconds) {
            throw new Error(t('Video is too long: the limit is {n} seconds.', { n: limits.maxVideoSeconds }));
          }
        }
        if (!isSuperadmin && limits && blob.size > limits.maxUploadMb * 1024 * 1024) {
          throw new Error(t('File is too large ({size}): the limit is {n} MB per file.', { size: formatBytes(blob.size), n: limits.maxUploadMb }));
        }

        const result = await uploadMedia(blob, filename, { origin, avgColor, onProgress: (f) => patch(id, { progress: f }) });
        patch(id, { progress: 1, status: 'done' });
        qc.invalidateQueries({ queryKey: ['media'] });
        qc.invalidateQueries({ queryKey: ['organization'] });
        onUploaded?.(result.asset, result.duplicate);
        setTimeout(() => dismiss(id), 2500);
      } catch (err) {
        patch(id, { status: 'error', error: err instanceof Error ? err.message : t('Upload failed') });
      }
    },
    [org.data, isSuperadmin, origin, patch, dismiss, qc, onUploaded, t],
  );

  /** Entry point for files from the picker or from drag-and-drop. */
  const handleFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/'));
      const images = accepted.filter((f) => f.type.startsWith('image/'));
      const askCrop = crop === 'always' || (crop === 'single' && accepted.length === 1 && images.length === 1);
      const direct = askCrop ? accepted.filter((f) => !f.type.startsWith('image/') || f.type === 'image/gif') : accepted;
      const toCrop = askCrop ? images.filter((f) => f.type !== 'image/gif') : [];
      direct.forEach((f) => void run(f));
      if (toCrop.length) setCropQueue((q) => [...q, ...toCrop]);
    },
    [crop, run],
  );

  const current = cropQueue[0];
  const nextCrop = () => setCropQueue((q) => q.slice(1));

  const host = (
    <>
      <input
        ref={input}
        type="file"
        hidden
        multiple={multiple}
        accept={accept}
        onChange={(e) => {
          handleFiles(Array.from(e.target.files ?? []));
          e.target.value = '';
        }}
      />
      {current && (
        <CropDialog
          key={`${current.name}-${current.size}-${cropQueue.length}`}
          file={current}
          initialAspect={initialAspect}
          onCancel={nextCrop}
          onUseOriginal={() => {
            void run(current);
            nextCrop();
          }}
          onConfirm={(rect) => {
            void run(current, rect);
            nextCrop();
          }}
        />
      )}
    </>
  );

  return {
    open: () => input.current?.click(),
    handleFiles,
    host,
    uploads,
    dismiss,
    busy: uploads.some((u) => u.status === 'uploading') || cropQueue.length > 0,
  };
}

/** Progress rows for in-flight uploads. */
export function UploadList({ uploads, onDismiss }: { uploads: UploadItem[]; onDismiss: (id: number) => void }) {
  if (uploads.length === 0) return null;
  return (
    <ul className="space-y-2">
      {uploads.map((u) => (
        <li
          key={u.id}
          className={cn('rounded border px-3 py-2 text-sm', u.status === 'error' ? 'border-danger/40 bg-danger-soft' : 'border-line bg-surface')}
        >
          <div className="flex items-center gap-2">
            {u.status === 'done' && <IconCheck className="h-4 w-4 flex-shrink-0 text-success" />}
            {u.status === 'error' && <IconWarning className="h-4 w-4 flex-shrink-0 text-danger" />}
            <span className="min-w-0 flex-1 truncate">{u.name}</span>
            {u.status === 'uploading' && <span className="text-xs tabular-nums text-ink-3">{Math.round(u.progress * 100)}%</span>}
            {u.status !== 'uploading' && (
              <button type="button" onClick={() => onDismiss(u.id)} aria-label="Dismiss" className="text-ink-3 hover:text-ink">
                <IconX className="h-4 w-4" />
              </button>
            )}
          </div>
          {u.status === 'uploading' && <Progress value={u.progress * 100} className="mt-2" />}
          {u.status === 'error' && <p className="mt-1 text-xs text-danger">{u.error}</p>}
        </li>
      ))}
    </ul>
  );
}
