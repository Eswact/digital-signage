'use client';

import { API_URL, ApiError, freshAccessToken, MediaItem } from './api';

/** Longest side of images we keep: 4K is plenty for any signage screen. */
export const MAX_IMAGE_SIDE = 3840;

export interface UploadResult {
  asset: MediaItem;
  duplicate: boolean;
}

/**
 * Uploads one file with progress (XMLHttpRequest — fetch cannot report upload progress).
 * `origin` records where in the panel it was added from; the file lands in the same
 * library either way.
 */
export async function uploadMedia(
  file: Blob,
  filename: string,
  opts: {
    origin?: 'library' | 'screen' | 'overlay';
    avgColor?: string | null;
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  } = {},
): Promise<UploadResult> {
  const token = await freshAccessToken();
  const form = new FormData();
  form.append('file', file, filename);
  if (opts.origin) form.append('origin', opts.origin);
  if (opts.avgColor) form.append('avgColor', opts.avgColor);

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_URL}/media`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(e.loaded / e.total);
    xhr.onerror = () => reject(new ApiError(0, 'Network error — the upload was interrupted'));
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled'));
    xhr.onload = () => {
      let body: Record<string, unknown> | undefined;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = undefined;
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body as unknown as UploadResult);
      const message = Array.isArray(body?.message) ? (body.message as string[]).join(', ') : ((body?.message as string) ?? xhr.statusText);
      reject(new ApiError(xhr.status, message, body?.code as string | undefined, body));
    };
    opts.signal?.addEventListener('abort', () => xhr.abort());
    xhr.send(form);
  });
}

// --- Image helpers -----------------------------------------------------------------

export async function loadImage(blob: Blob): Promise<{ img: HTMLImageElement; url: string }> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error('This image could not be read');
  }
  return { img, url };
}

/** Average color (#rrggbb) of an image, computed on a tiny downscaled copy. */
export function averageColor(img: CanvasImageSource): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 16;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return '#000000';
  ctx.drawImage(img, 0, 0, 16, 16);
  const { data } = ctx.getImageData(0, 0, 16, 16);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] / 255;
    if (a < 0.1) continue;
    r += data[i] * a;
    g += data[i + 1] * a;
    b += data[i + 2] * a;
    n += a;
  }
  if (n === 0) return '#000000';
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Output format keeps transparency for PNG/WebP/GIF sources, JPEG otherwise. */
function outputType(sourceType: string): { type: string; ext: string; quality?: number } {
  return /png|webp|gif/.test(sourceType) ? { type: 'image/png', ext: 'png' } : { type: 'image/jpeg', ext: 'jpg', quality: 0.92 };
}

/** Crops (optional) and downscales an image; returns the new file and its average color. */
export async function processImage(
  source: File,
  crop?: CropRect,
): Promise<{ blob: Blob; filename: string; avgColor: string; changed: boolean }> {
  const { img, url } = await loadImage(source);
  try {
    const sw = crop?.w ?? img.naturalWidth;
    const sh = crop?.h ?? img.naturalHeight;
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(sw, sh));
    const avgColor = averageColor(img);
    const untouched = !crop && scale === 1;
    // Animated GIFs would lose their animation when redrawn; keep originals that need no crop.
    if (untouched || (source.type === 'image/gif' && !crop)) {
      return { blob: source, filename: source.name, avgColor, changed: false };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * scale));
    canvas.height = Math.max(1, Math.round(sh * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is not available in this browser');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, crop?.x ?? 0, crop?.y ?? 0, sw, sh, 0, 0, canvas.width, canvas.height);
    const out = outputType(source.type);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image'))), out.type, out.quality),
    );
    const base = source.name.replace(/\.[^.]+$/, '') || 'image';
    return { blob, filename: `${base}.${out.ext}`, avgColor, changed: true };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Reads a video's duration in the browser (for an early, friendly limit check). */
export function videoDuration(file: Blob): Promise<number | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => done(Number.isFinite(video.duration) ? video.duration : null);
    video.onerror = () => done(null);
    video.src = url;
  });
}
