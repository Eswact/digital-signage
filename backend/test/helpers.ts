import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import WebSocket from 'ws';
import { AddressInfo } from 'net';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

export interface TestApp {
  app: NestExpressApplication;
  /** http://127.0.0.1:<port> */
  base: string;
  http: ReturnType<typeof request>;
  close: () => Promise<void>;
}

/** Uygulamayı bellek içi SQLite ile rastgele portta ayağa kaldırır. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address() as AddressInfo;
  const base = `http://127.0.0.1:${address.port}`;
  return {
    app,
    base,
    http: request(app.getHttpServer()),
    close: () => app.close(),
  };
}

export async function login(t: TestApp, email: string, password: string): Promise<string> {
  const res = await t.http.post('/api/auth/login').send({ email, password }).expect(201);
  return res.body.accessToken;
}

export const adminLogin = (t: TestApp) =>
  login(t, process.env.ADMIN_EMAIL!, process.env.ADMIN_PASSWORD!);

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export interface WsMessage {
  type: string;
  // Testler payload alanlarına doğrudan erişir (şekil mesaj tipine göre değişir).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any;
}

/** Android cihazı taklit eden WS istemcisi: mesajları sıraya alır, tipe göre bekler. */
export class DeviceClient {
  private queue: WsMessage[] = [];
  private waiters: Array<{ type: string; resolve: (m: WsMessage) => void }> = [];
  readonly closed: Promise<{ code: number; reason: string }>;

  private constructor(readonly ws: WebSocket) {
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString()) as WsMessage;
      const i = this.waiters.findIndex((w) => w.type === msg.type);
      if (i >= 0) this.waiters.splice(i, 1)[0].resolve(msg);
      else this.queue.push(msg);
    });
    this.closed = new Promise((resolve) =>
      ws.on('close', (code, reason) => resolve({ code, reason: reason.toString() })),
    );
  }

  static connect(
    t: TestApp,
    opts: { deviceId: string; secret?: string; proto?: number },
  ): DeviceClient {
    const proto = opts.proto ?? 1;
    const url = `${t.base.replace('http', 'ws')}/ws?deviceId=${opts.deviceId}&proto=${proto}`;
    const headers = opts.secret ? { 'X-Device-Secret': opts.secret } : undefined;
    return new DeviceClient(new WebSocket(url, { headers }));
  }

  /** İlk `type` mesajını döner (önceden geldiyse sıradan alır). */
  next(type: string, timeoutMs = 3000): Promise<WsMessage> {
    const i = this.queue.findIndex((m) => m.type === type);
    if (i >= 0) return Promise.resolve(this.queue.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${type} gelmedi`)), timeoutMs);
      this.waiters.push({
        type,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
    });
  }

  send(msg: WsMessage) {
    this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.ws.close();
  }
}

/** Cihazı kaydeder; gizli anahtarı döner. */
export async function registerDevice(t: TestApp, deviceId: string): Promise<string> {
  const res = await t.http
    .post('/api/devices/register')
    .send({ deviceId, appVersion: 2, appVersionName: '0.2.0', templates: { 'info-board': 1 } })
    .expect(201);
  return res.body.secret;
}

// --- Media fixtures ---

/** Valid 1×1 PNG; `salt` appends ignorable trailing bytes so each upload has a distinct hash. */
export function pngBuffer(salt = ''): Buffer {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  return Buffer.concat([png, Buffer.from(salt)]);
}

/** Minimal MP4-looking buffer (ftyp box); the fake ffprobe supplies duration/size. */
export function mp4Buffer(salt = ''): Buffer {
  const head = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x6d, 0x70, 0x34, 0x32, 0, 0, 0, 0, 0x6d, 0x70, 0x34, 0x32, 0x69, 0x73, 0x6f, 0x6d]);
  return Buffer.concat([head, Buffer.from(salt || 'video')]);
}

/** Creates a user with their own organization and returns a session. */
export async function createUserSession(
  t: TestApp,
  admin: string,
  email: string,
  password = 'password-123',
) {
  await t.http.post('/api/users').set(bearer(admin)).send({ email, password, role: 'user' }).expect(201);
  const res = await t.http.post('/api/auth/login').send({ email, password }).expect(201);
  return res.body as { accessToken: string; refreshToken: string; organization: { id: string; role: string } };
}
