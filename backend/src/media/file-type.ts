import { promises as fs } from 'fs';
import { MediaKind } from './media-asset.entity';

export interface DetectedType {
  kind: MediaKind;
  mime: string;
  ext: string;
}

/**
 * Identifies the file from its magic bytes — the client-supplied MIME type and
 * file name are never trusted. SVG is deliberately not accepted (script risk).
 */
export async function detectFileType(path: string): Promise<DetectedType | null> {
  const fd = await fs.open(path, 'r');
  try {
    const buf = Buffer.alloc(32);
    const { bytesRead } = await fd.read(buf, 0, 32, 0);
    if (bytesRead < 12) return null;
    const ascii = (from: number, to: number) => buf.subarray(from, to).toString('latin1');

    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: 'image', mime: 'image/jpeg', ext: '.jpg' };
    if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return { kind: 'image', mime: 'image/png', ext: '.png' };
    }
    if (ascii(0, 4) === 'GIF8') return { kind: 'image', mime: 'image/gif', ext: '.gif' };
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp', ext: '.webp' };
    if (ascii(4, 8) === 'ftyp') {
      const brand = ascii(8, 12);
      // QuickTime ('qt  ') is rejected: ExoPlayer does not play it reliably.
      if (brand !== 'qt  ') return { kind: 'video', mime: 'video/mp4', ext: '.mp4' };
    }
    if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
      return { kind: 'video', mime: 'video/webm', ext: '.webm' };
    }
    return null;
  } finally {
    await fd.close();
  }
}
