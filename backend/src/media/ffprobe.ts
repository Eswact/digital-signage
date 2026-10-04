import { execFile } from 'child_process';

export interface VideoInfo {
  durationSec: number;
  width: number | null;
  height: number | null;
}

/** Thrown when ffprobe is not installed / not executable. */
export class FfprobeUnavailableError extends Error {}

/**
 * Reads duration and dimensions with `ffprobe` (PATH, or FFPROBE_PATH). The
 * server — not the client — decides how long an uploaded video really is.
 */
export function probeVideo(path: string, ffprobe = process.env.FFPROBE_PATH || 'ffprobe'): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    execFile(
      ffprobe,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path],
      { timeout: 20_000, maxBuffer: 4 * 1024 * 1024, env: process.env },
      (err, stdout) => {
        if (err) {
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            return reject(new FfprobeUnavailableError('ffprobe is not installed'));
          }
          return reject(new Error('Could not read the video file'));
        }
        try {
          const json = JSON.parse(stdout) as {
            format?: { duration?: string };
            streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>;
          };
          const video = json.streams?.find((s) => s.codec_type === 'video');
          const duration = Number(json.format?.duration ?? video?.duration);
          if (!video || !Number.isFinite(duration) || duration <= 0) {
            return reject(new Error('Could not read the video file'));
          }
          resolve({ durationSec: duration, width: video.width ?? null, height: video.height ?? null });
        } catch {
          reject(new Error('Could not read the video file'));
        }
      },
    );
  });
}

/** True when an ffprobe binary can be executed (shown on the admin settings page). */
export function ffprobeAvailable(ffprobe = process.env.FFPROBE_PATH || 'ffprobe'): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(ffprobe, ['-version'], { timeout: 5_000 }, (err) => resolve(!err));
  });
}
