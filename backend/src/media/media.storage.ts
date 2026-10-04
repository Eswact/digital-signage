import { createReadStream, createWriteStream, promises as fs } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

export interface ByteRange {
  start: number;
  end: number;
}

export interface StoredObject {
  stream: Readable;
  size: number;
}

/**
 * Where media bytes live. `LocalDiskStorage` is the default; `S3Storage` talks to
 * any S3-compatible service (AWS S3, Cloudflare R2, MinIO).
 */
export interface MediaStorage {
  /** Stores the file at `srcPath` under `key` (the source file is consumed). */
  put(key: string, srcPath: string, contentType: string): Promise<void>;
  /** Streams the object, or only `range` of it. */
  open(key: string, range?: ByteRange): Promise<StoredObject>;
  delete(key: string): Promise<void>;
}

export class LocalDiskStorage implements MediaStorage {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private path(key: string): string {
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, srcPath: string): Promise<void> {
    const dest = this.path(key);
    await fs.mkdir(dirname(dest), { recursive: true });
    try {
      await fs.rename(srcPath, dest);
    } catch (e) {
      // Different filesystem (e.g. tmp on another volume): copy then remove.
      if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
      await pipeline(createReadStream(srcPath), createWriteStream(dest));
      await fs.unlink(srcPath);
    }
  }

  async open(key: string, range?: ByteRange): Promise<StoredObject> {
    const file = this.path(key);
    const { size } = await fs.stat(file);
    return { stream: createReadStream(file, range), size };
  }

  async delete(key: string): Promise<void> {
    await fs.unlink(this.path(key)).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
  }
}

export interface S3Options {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  forcePathStyle?: boolean;
}

/**
 * S3-compatible driver. The AWS SDK is loaded lazily so it costs nothing unless
 * `MEDIA_STORAGE=s3`. NOTE: not verified against a real bucket in this repo's tests.
 */
export class S3Storage implements MediaStorage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sdk: any;

  constructor(private readonly opts: S3Options) {}

  private async init() {
    if (this.client) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    this.sdk = require('@aws-sdk/client-s3');
    this.client = new this.sdk.S3Client({
      region: this.opts.region,
      endpoint: this.opts.endpoint,
      forcePathStyle: this.opts.forcePathStyle,
      credentials:
        this.opts.accessKeyId && this.opts.secretAccessKey
          ? { accessKeyId: this.opts.accessKeyId, secretAccessKey: this.opts.secretAccessKey }
          : undefined,
    });
  }

  async put(key: string, srcPath: string, contentType: string): Promise<void> {
    await this.init();
    const { size } = await fs.stat(srcPath);
    await this.client.send(
      new this.sdk.PutObjectCommand({
        Bucket: this.opts.bucket,
        Key: key,
        Body: createReadStream(srcPath),
        ContentLength: size,
        ContentType: contentType,
      }),
    );
    await fs.unlink(srcPath);
  }

  async open(key: string, range?: ByteRange): Promise<StoredObject> {
    await this.init();
    const res = await this.client.send(
      new this.sdk.GetObjectCommand({
        Bucket: this.opts.bucket,
        Key: key,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }),
    );
    // For a ranged read ContentLength is the slice length; callers pass the full size separately.
    return { stream: res.Body as Readable, size: Number(res.ContentLength) };
  }

  async delete(key: string): Promise<void> {
    await this.init();
    await this.client.send(new this.sdk.DeleteObjectCommand({ Bucket: this.opts.bucket, Key: key }));
  }
}
