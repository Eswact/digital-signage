import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import { join } from 'path';
import { imageSize } from 'image-size';
import { MediaAsset, MediaKind, MediaOrigin } from './media-asset.entity';
import { ByteRange, LocalDiskStorage, MediaStorage, S3Storage, StoredObject } from './media.storage';
import { detectFileType } from './file-type';
import { FfprobeUnavailableError, ffprobeAvailable, probeVideo } from './ffprobe';
import { Screen } from '../screens/screen.entity';
import { LimitsService } from '../organizations/limits.service';
import { EventBusService } from '../events/event-bus.service';
import { AuthUser } from '../auth/current-user.decorator';
import { inScope, orgScope, ownerOrgId } from '../common/scope';

/** Fields copied from the library onto every reference inside screen data. */
export interface AssetRef {
  mediaId: string;
  kind: MediaKind;
  sha256: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  avgColor: string | null;
}

export interface MediaView {
  id: string;
  kind: MediaKind;
  name: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  sha256: string;
  avgColor: string | null;
  origin: MediaOrigin;
  createdAt: Date;
  usedBy: Array<{ id: string; name: string }>;
}

export const mediaRoot = (config: ConfigService): string =>
  config.get<string>('MEDIA_DIR') || join(process.cwd(), 'data', 'media');
export const mediaTmpDir = (config: ConfigService): string => join(mediaRoot(config), '.tmp');

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const IMAGE_HEADER_BYTES = 1024 * 1024;

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  readonly storage: MediaStorage;
  /** Directory multer writes incoming files to before validation. */
  readonly tmpDir: string;
  readonly driver: 'local' | 's3';

  constructor(
    @InjectRepository(MediaAsset) private readonly assets: Repository<MediaAsset>,
    @InjectRepository(Screen) private readonly screens: Repository<Screen>,
    private readonly limits: LimitsService,
    private readonly bus: EventBusService,
    config: ConfigService,
  ) {
    const dir = mediaRoot(config);
    this.tmpDir = mediaTmpDir(config);
    this.driver = config.get<string>('MEDIA_STORAGE') === 's3' ? 's3' : 'local';
    if (this.driver === 's3') {
      this.storage = new S3Storage({
        bucket: config.getOrThrow<string>('S3_BUCKET'),
        region: config.get<string>('S3_REGION') || 'auto',
        endpoint: config.get<string>('S3_ENDPOINT') || undefined,
        accessKeyId: config.get<string>('S3_ACCESS_KEY_ID') || undefined,
        secretAccessKey: config.get<string>('S3_SECRET_ACCESS_KEY') || undefined,
        forcePathStyle: config.get<string>('S3_FORCE_PATH_STYLE') === 'true',
      });
    } else {
      this.storage = new LocalDiskStorage(dir);
    }
    this.allowUnverifiedVideo = config.get<string>('MEDIA_ALLOW_UNVERIFIED_VIDEO') === 'true';
  }

  private readonly allowUnverifiedVideo: boolean;

  /** Hard ceiling for any single upload, enforced while receiving (the org limit is checked after). */
  static hardMaxBytes(config: ConfigService): number {
    return Number(config.get('MEDIA_HARD_MAX_MB') ?? 1024) * 1024 * 1024;
  }

  async onModuleInit() {
    await fs.mkdir(this.tmpDir, { recursive: true });
    if (!this.allowUnverifiedVideo && !(await ffprobeAvailable())) {
      this.logger.warn(
        'ffprobe not found: video uploads are rejected (install ffmpeg, set FFPROBE_PATH, or MEDIA_ALLOW_UNVERIFIED_VIDEO=true for development).',
      );
    }
  }

  /** System info for the admin settings page. */
  async systemInfo() {
    return {
      storage: this.driver,
      ffprobe: await ffprobeAvailable(),
      allowUnverifiedVideo: this.allowUnverifiedVideo,
    };
  }

  // --- Upload / list / rename / delete ---

  async upload(
    viewer: AuthUser,
    file: { path: string; originalname: string },
    fields: { origin?: string; avgColor?: string; name?: string },
  ): Promise<{ asset: MediaView; duplicate: boolean }> {
    try {
      const orgId = ownerOrgId(viewer);
      const type = await detectFileType(file.path);
      if (!type) {
        throw new UnsupportedMediaTypeException('Unsupported file type. Use JPEG, PNG, GIF, WebP, MP4 or WebM.');
      }
      const { size } = await fs.stat(file.path);
      const sha256 = await hashFile(file.path);

      const existing = await this.assets.findOne({ where: { organizationId: orgId, sha256 } });
      if (existing) return { asset: await this.toView(existing), duplicate: true };

      let width: number | null = null;
      let height: number | null = null;
      let durationMs: number | null = null;
      if (type.kind === 'image') {
        const dims = await readImageSize(file.path);
        if (!dims) throw new BadRequestException('Could not read the image');
        ({ width, height } = dims);
      } else {
        try {
          const info = await probeVideo(file.path);
          width = info.width;
          height = info.height;
          durationMs = Math.round(info.durationSec * 1000);
        } catch (e) {
          if (!(e instanceof FfprobeUnavailableError)) throw new UnprocessableEntityException((e as Error).message);
          if (!this.allowUnverifiedVideo) {
            throw new HttpException(
              'Video uploads need ffprobe on the server to verify the video length.',
              HttpStatus.SERVICE_UNAVAILABLE,
            );
          }
          this.logger.warn('Accepting a video without ffprobe verification (MEDIA_ALLOW_UNVERIFIED_VIDEO)');
        }
      }

      await this.limits.assertCanUpload(viewer, orgId, {
        sizeBytes: size,
        kind: type.kind,
        durationSec: durationMs == null ? null : durationMs / 1000,
      });

      const id = randomUUID();
      const storageKey = `${orgId}/${id}${type.ext}`;
      // multer hands over the file name as latin1-decoded bytes: restore the UTF-8 original.
      const decoded = Buffer.from(file.originalname || '', 'latin1').toString('utf8');
      const originalName = (decoded || `upload${type.ext}`).slice(0, 200);
      const baseName = originalName.replace(/\.[^.]+$/, '') || originalName;
      await this.storage.put(storageKey, file.path, type.mime);

      const origin: MediaOrigin =
        fields.origin === 'screen' || fields.origin === 'overlay' ? fields.origin : 'library';
      const asset = this.assets.create({
        id,
        organizationId: orgId,
        uploadedById: viewer.id,
        kind: type.kind,
        name: (fields.name?.trim() || baseName).slice(0, 120),
        originalName,
        mimeType: type.mime,
        sizeBytes: size,
        width,
        height,
        durationMs,
        sha256,
        avgColor: fields.avgColor && HEX_COLOR.test(fields.avgColor) ? fields.avgColor.toLowerCase() : null,
        origin,
        storageKey,
      });
      try {
        await this.assets.save(asset);
      } catch (e) {
        await this.storage.delete(storageKey).catch(() => undefined);
        throw e;
      }
      this.bus.notifyOrg(orgId, 'media', id);
      return { asset: await this.toView(asset), duplicate: false };
    } finally {
      await fs.unlink(file.path).catch(() => undefined);
    }
  }

  async list(viewer: AuthUser, kind?: MediaKind): Promise<MediaView[]> {
    const rows = await this.assets.find({
      where: { ...orgScope(viewer), ...(kind ? { kind } : {}) },
      order: { createdAt: 'DESC' },
    });
    const usage = await this.usageMap(rows.map((r) => r.organizationId));
    return rows.map((r) => this.view(r, usage.get(r.id) ?? []));
  }

  async findForViewer(viewer: AuthUser, id: string): Promise<MediaAsset> {
    const asset = await this.assets.findOne({ where: { id } });
    if (!asset || !inScope(viewer, asset.organizationId)) throw new NotFoundException('Media file not found');
    return asset;
  }

  async rename(viewer: AuthUser, id: string, name: string): Promise<MediaView> {
    const asset = await this.findForViewer(viewer, id);
    asset.name = name.trim().slice(0, 120);
    await this.assets.save(asset);
    this.bus.notifyOrg(asset.organizationId, 'media', id);
    return this.toView(asset);
  }

  async remove(viewer: AuthUser, id: string): Promise<void> {
    const asset = await this.findForViewer(viewer, id);
    const usedBy = (await this.usageMap([asset.organizationId])).get(id) ?? [];
    if (usedBy.length > 0) {
      throw new ConflictException({
        message: `This file is used by ${usedBy.length} screen(s): ${usedBy.map((s) => s.name).join(', ')}. Remove it from them first.`,
        code: 'MEDIA_IN_USE',
        screens: usedBy,
      });
    }
    await this.assets.remove(asset);
    await this.storage.delete(asset.storageKey).catch((e: Error) => this.logger.warn(`Storage delete failed: ${e.message}`));
    this.bus.notifyOrg(asset.organizationId, 'media', id);
  }

  // --- Public file serving ---

  async openFile(
    id: string,
    rangeHeader?: string,
  ): Promise<{ asset: MediaAsset; object: StoredObject; range: ByteRange | null }> {
    const asset = await this.assets.findOne({ where: { id } });
    if (!asset) throw new NotFoundException('Media file not found');
    const range = rangeHeader ? parseRange(rangeHeader, asset.sizeBytes) : null;
    if (range === 'invalid') {
      throw new HttpException({ message: 'Range not satisfiable', size: asset.sizeBytes }, HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE);
    }
    return { asset, object: await this.storage.open(asset.storageKey, range ?? undefined), range };
  }

  // --- References inside screen data ---

  /**
   * Validates every media reference in screen data (items[], overlays.*[].media):
   * the asset must belong to the organization, and the descriptor fields are
   * overwritten from the library so clients cannot forge hashes or sizes.
   * Returns a normalized copy.
   */
  async normalizeRefs<T extends Record<string, unknown>>(orgId: string, data: T): Promise<T> {
    const copy = structuredClone(data);
    const holders = collectRefHolders(copy);
    if (holders.length === 0) return copy;

    const ids = [...new Set(holders.map((h) => h.mediaId))];
    const found = await this.assets.find({ where: { id: In(ids), organizationId: orgId } });
    const byId = new Map(found.map((a) => [a.id, a]));
    const missing = ids.filter((i) => !byId.has(i));
    if (missing.length > 0) throw new BadRequestException(`Unknown media file: ${missing[0]}`);

    for (const holder of holders) {
      const a = byId.get(holder.mediaId)!;
      Object.assign(holder.target, {
        kind: a.kind,
        sha256: a.sha256,
        bytes: a.sizeBytes,
        width: a.width ?? null,
        height: a.height ?? null,
        durationMs: a.durationMs ?? null,
        avgColor: a.avgColor ?? null,
      } satisfies Omit<AssetRef, 'mediaId'>);
    }
    return copy;
  }

  // --- Helpers ---

  /** assetId → screens (of the same organizations) whose data mentions it. */
  private async usageMap(orgIds: string[]): Promise<Map<string, Array<{ id: string; name: string }>>> {
    const map = new Map<string, Array<{ id: string; name: string }>>();
    if (orgIds.length === 0) return map;
    const screens = await this.screens.find({
      where: { organizationId: In([...new Set(orgIds)]) },
      select: { id: true, name: true, data: true },
    });
    for (const screen of screens) {
      for (const mediaId of collectRefHolders(structuredClone(screen.data ?? {})).map((h) => h.mediaId)) {
        const list = map.get(mediaId) ?? [];
        if (!list.some((s) => s.id === screen.id)) list.push({ id: screen.id, name: screen.name });
        map.set(mediaId, list);
      }
    }
    return map;
  }

  private async toView(asset: MediaAsset): Promise<MediaView> {
    const usage = await this.usageMap([asset.organizationId]);
    return this.view(asset, usage.get(asset.id) ?? []);
  }

  private view(a: MediaAsset, usedBy: MediaView['usedBy']): MediaView {
    return {
      id: a.id,
      kind: a.kind,
      name: a.name,
      originalName: a.originalName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      width: a.width ?? null,
      height: a.height ?? null,
      durationMs: a.durationMs ?? null,
      sha256: a.sha256,
      avgColor: a.avgColor ?? null,
      origin: a.origin,
      createdAt: a.createdAt,
      usedBy,
    };
  }
}

/** Objects in screen data that carry a `mediaId` (slides and banner/badge media). */
export function collectRefHolders(data: Record<string, unknown>): Array<{ mediaId: string; target: Record<string, unknown> }> {
  const out: Array<{ mediaId: string; target: Record<string, unknown> }> = [];
  const take = (o: unknown) => {
    if (o && typeof o === 'object' && typeof (o as { mediaId?: unknown }).mediaId === 'string') {
      out.push({ mediaId: (o as { mediaId: string }).mediaId, target: o as Record<string, unknown> });
    }
  };
  if (Array.isArray(data.items)) data.items.forEach(take);
  const overlays = data.overlays as { banners?: unknown; badges?: unknown } | undefined;
  for (const list of [overlays?.banners, overlays?.badges]) {
    if (Array.isArray(list)) list.forEach((o) => take((o as { media?: unknown } | null)?.media));
  }
  return out;
}

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function readImageSize(path: string): Promise<{ width: number; height: number } | null> {
  const fd = await fs.open(path, 'r');
  try {
    const buf = Buffer.alloc(IMAGE_HEADER_BYTES);
    const { bytesRead } = await fd.read(buf, 0, IMAGE_HEADER_BYTES, 0);
    const dims = imageSize(buf.subarray(0, bytesRead));
    return dims.width && dims.height ? { width: dims.width, height: dims.height } : null;
  } catch {
    return null;
  } finally {
    await fd.close();
  }
}

/** Parses a single `bytes=a-b` range; returns 'invalid' when unsatisfiable. */
export function parseRange(header: string, size: number): ByteRange | 'invalid' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null; // ignore malformed / multi-range → full body
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (suffix === 0) return 'invalid';
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}
