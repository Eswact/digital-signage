import { rmSync } from 'fs';
import { TestApp, adminLogin, bearer, createTestApp, createUserSession, mp4Buffer, pngBuffer } from './helpers';

describe('Medya kütüphanesi', () => {
  let t: TestApp;
  let admin: string;
  let owner: { accessToken: string; organization: { id: string } };
  let other: { accessToken: string };

  beforeAll(async () => {
    t = await createTestApp();
    admin = await adminLogin(t);
    owner = await createUserSession(t, admin, 'media-owner@test.local');
    other = await createUserSession(t, admin, 'media-other@test.local');
  });
  afterAll(async () => {
    await t.close();
    rmSync(process.env.MEDIA_DIR!, { recursive: true, force: true });
  });

  const upload = (token: string, buf: Buffer, filename: string, fields: Record<string, string> = {}) => {
    const req = t.http.post('/api/media').set(bearer(token)).attach('file', buf, filename);
    for (const [k, v] of Object.entries(fields)) req.field(k, v);
    return req;
  };

  it('yükler, aynı dosyayı tekrar kaydetmez, herkese açık dosya adresinden Range/ETag ile sunar', async () => {
    const res = await upload(owner.accessToken, pngBuffer('a'), 'Logo Dosyası.png', {
      origin: 'screen',
      avgColor: '#112233',
    }).expect(201);
    expect(res.body.duplicate).toBe(false);
    expect(res.body.asset).toMatchObject({
      kind: 'image',
      name: 'Logo Dosyası',
      mimeType: 'image/png',
      width: 1,
      height: 1,
      origin: 'screen',
      avgColor: '#112233',
      usedBy: [],
    });
    expect(res.body.asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    const id: string = res.body.asset.id;

    const again = await upload(owner.accessToken, pngBuffer('a'), 'kopya.png').expect(201);
    expect(again.body).toMatchObject({ duplicate: true, asset: { id } });

    // Auth gerektirmez (cihazlar başlıksız çeker).
    const full = await t.http.get(`/api/media/file/${id}`).expect(200);
    expect(full.headers['content-type']).toBe('image/png');
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(full.headers['cache-control']).toContain('immutable');
    expect(full.body).toEqual(pngBuffer('a'));

    const etag = full.headers['etag'];
    await t.http.get(`/api/media/file/${id}`).set('If-None-Match', etag).expect(304);

    const part = await t.http.get(`/api/media/file/${id}`).set('Range', 'bytes=0-7').expect(206);
    expect(part.headers['content-range']).toBe(`bytes 0-7/${pngBuffer('a').length}`);
    expect(part.body).toEqual(pngBuffer('a').subarray(0, 8));
    await t.http.get(`/api/media/file/${id}`).set('Range', 'bytes=9999-').expect(416);
  });

  it('dosya türü içerikten doğrulanır (SVG/metin reddedilir, uzantıya güvenilmez)', async () => {
    await upload(owner.accessToken, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'x.svg').expect(415);
    await upload(owner.accessToken, Buffer.from('hello world, not an image'), 'fake.png').expect(415);
    await t.http.post('/api/media').set(bearer(owner.accessToken)).expect(400);
  });

  it('organizasyonlar arası izolasyon ve roller', async () => {
    const mine = await t.http.get('/api/media').set(bearer(owner.accessToken)).expect(200);
    expect(mine.body.length).toBeGreaterThan(0);
    const theirs = await t.http.get('/api/media').set(bearer(other.accessToken)).expect(200);
    expect(theirs.body).toEqual([]);

    const id = mine.body[0].id;
    await t.http.patch(`/api/media/${id}`).set(bearer(other.accessToken)).send({ name: 'x' }).expect(404);
    await t.http.delete(`/api/media/${id}`).set(bearer(other.accessToken)).expect(404);
    const renamed = await t.http
      .patch(`/api/media/${id}`)
      .set(bearer(owner.accessToken))
      .send({ name: 'Yeni ad' })
      .expect(200);
    expect(renamed.body.name).toBe('Yeni ad');

    // Salt okunur üye listeler ama yükleyemez.
    const invite = await t.http
      .post('/api/organization/invitations')
      .set(bearer(owner.accessToken))
      .send({ email: 'media-viewer@test.local', role: 'viewer' })
      .expect(201);
    const viewer = await t.http
      .post('/api/auth/invitation/accept')
      .send({ token: invite.body.token, password: 'password-123' })
      .expect(201);
    await t.http.get('/api/media').set(bearer(viewer.body.accessToken)).expect(200);
    await upload(viewer.body.accessToken, pngBuffer('viewer'), 'v.png').expect(403);
    await t.http.delete(`/api/media/${id}`).set(bearer(viewer.body.accessToken)).expect(403);
  });

  it('video: süre ffprobe ile sunucuda okunur ve süre limiti zorlanır', async () => {
    process.env.FAKE_DURATION = '42.5';
    const ok = await upload(owner.accessToken, mp4Buffer('v1'), 'clip.mp4').expect(201);
    expect(ok.body.asset).toMatchObject({ kind: 'video', mimeType: 'video/mp4', durationMs: 42500, width: 1280, height: 720 });

    process.env.FAKE_DURATION = '500'; // varsayılan limit 120 sn
    const long = await upload(owner.accessToken, mp4Buffer('v2'), 'long.mp4').expect(403);
    expect(long.body).toMatchObject({ code: 'LIMIT_REACHED', resource: 'video-duration', limit: 120 });
    delete process.env.FAKE_DURATION;
  });

  it('limitler: dosya boyutu, dosya sayısı ve depolama kotası', async () => {
    const orgId = owner.organization.id;
    const patch = (limits: Record<string, number>) =>
      t.http.patch(`/api/admin/organizations/${orgId}`).set(bearer(admin)).send({ limits }).expect(200);

    // Tek dosya boyutu: sınır 1 MB. Yükleme sonrası kontrol (Content-Length baştan geçerse) …
    await patch({ maxUploadMb: 1 });
    const mid = await upload(owner.accessToken, Buffer.concat([pngBuffer('mid'), Buffer.alloc(1_500_000)]), 'mid.png').expect(403);
    expect(mid.body).toMatchObject({ code: 'LIMIT_REACHED', resource: 'upload', limit: 1 });
    // … ve çok büyükse Content-Length'ten baştan reddedilir (istemci yanıt yerine bağlantı kesintisi de görebilir).
    const huge = await upload(owner.accessToken, Buffer.concat([pngBuffer('huge'), Buffer.alloc(3 * 1024 * 1024)]), 'huge.png').then(
      (r) => r.status,
      (e: NodeJS.ErrnoException) => e.code,
    );
    expect([400, 'ECONNRESET', 'EPIPE']).toContain(huge);

    // Dosya sayısı
    const count = (await t.http.get('/api/media').set(bearer(owner.accessToken))).body.length;
    await patch({ maxUploadMb: 100, maxMediaFiles: count });
    const full = await upload(owner.accessToken, pngBuffer('count'), 'n.png').expect(403);
    expect(full.body).toMatchObject({ code: 'LIMIT_REACHED', resource: 'media', limit: count });

    // Depolama kotası (0 MB)
    await patch({ maxMediaFiles: 100, storageQuotaMb: 0 });
    const quota = await upload(owner.accessToken, pngBuffer('quota'), 'q.png').expect(403);
    expect(quota.body).toMatchObject({ code: 'LIMIT_REACHED', resource: 'storage' });

    // Süper yönetici limitlere takılmaz.
    await upload(admin, pngBuffer('admin-free'), 'a.png').expect(201);

    const org = await t.http.get('/api/organization').set(bearer(owner.accessToken)).expect(200);
    expect(org.body.usage.mediaFiles).toBe(count);
    expect(org.body.usage.storageBytes).toBeGreaterThan(0);
    await patch({ storageQuotaMb: 512 });
  });

  it('ekran verisindeki medya başvuruları doğrulanır, kütüphaneden doldurulur; kullanımdaki dosya silinemez', async () => {
    const list = (await t.http.get('/api/media').set(bearer(owner.accessToken))).body as Array<{
      id: string;
      kind: string;
      sha256: string;
    }>;
    const image = list.find((m) => m.kind === 'image')!;
    const otherAsset = (await upload(admin, pngBuffer('admins'), 'admins.png')).body.asset;

    // Başka organizasyonun medyası başvuru olamaz.
    await t.http
      .post('/api/screens')
      .set(bearer(owner.accessToken))
      .send({ name: 'x', template: 'media-player', data: { items: [{ id: 's1', mediaId: otherAsset.id }] } })
      .expect(400);

    const screen = await t.http
      .post('/api/screens')
      .set(bearer(owner.accessToken))
      .send({
        name: 'Vitrin',
        template: 'media-player',
        data: { items: [{ id: 's1', mediaId: image.id, sha256: 'forged', bytes: 1, durationSec: 5 }] },
      })
      .expect(201);
    const item = screen.body.data.items[0];
    expect(item.sha256).toBe(image.sha256); // sahte değer ezildi
    expect(item.kind).toBe('image');
    expect(item.bytes).toBeGreaterThan(1);

    // Banner görseli de aynı kütüphaneden başvurulur.
    await t.http
      .patch(`/api/screens/${screen.body.id}`)
      .set(bearer(owner.accessToken))
      .send({
        merge: {
          overlays: {
            banners: [{ id: 'b1', position: 'top', heightPct: 12, kind: 'image', media: { mediaId: image.id }, fit: 'cover' }],
            badges: [],
          },
        },
      })
      .expect(200);

    const del = await t.http.delete(`/api/media/${image.id}`).set(bearer(owner.accessToken)).expect(409);
    expect(del.body).toMatchObject({ code: 'MEDIA_IN_USE', screens: [{ id: screen.body.id, name: 'Vitrin' }] });
    const used = (await t.http.get('/api/media').set(bearer(owner.accessToken))).body.find((m: { id: string }) => m.id === image.id);
    expect(used.usedBy).toEqual([{ id: screen.body.id, name: 'Vitrin' }]);

    await t.http
      .patch(`/api/screens/${screen.body.id}`)
      .set(bearer(owner.accessToken))
      .send({ merge: { items: [], overlays: { banners: [], badges: [] } } })
      .expect(200);
    await t.http.delete(`/api/media/${image.id}`).set(bearer(owner.accessToken)).expect(200);
    await t.http.get(`/api/media/file/${image.id}`).expect(404);
  });

  it('şablon verisi doğrulaması: overlays ve webview', async () => {
    const make = (template: string, data: Record<string, unknown>) =>
      t.http.post('/api/screens').set(bearer(owner.accessToken)).send({ name: 'V', template, data });

    await make('info-board', { overlays: { banners: [{ id: 'a', position: 'top' }, { id: 'b', position: 'top' }], badges: [] } }).expect(400);
    await make('info-board', { overlays: { banners: [], badges: [{ id: 'a', corner: 'tl' }, { id: 'b', corner: 'tl' }] } }).expect(400);
    await make('info-board', { overlays: { banners: [{ id: 'a', position: 'left' }], badges: [] } }).expect(400);
    await make('webview', { url: 'javascript:alert(1)' }).expect(400);
    await make('webview', { url: 'ftp://example.com' }).expect(400);
    await make('media-player', { transition: 'spin' }).expect(400);
    await make('webview', { url: 'https://example.com/board', reloadSeconds: 60 }).expect(201);

    const templates = (await t.http.get('/api/screens/templates').set(bearer(owner.accessToken)).expect(200)).body;
    expect(templates.map((x: { type: string }) => x.type)).toEqual(
      expect.arrayContaining(['media-player', 'webview', 'info-board', 'order-board', 'queue-number']),
    );
  });

  it('süper yönetici sistem bilgisini görür, diğerleri göremez', async () => {
    const sys = await t.http.get('/api/admin/system').set(bearer(admin)).expect(200);
    expect(sys.body.media).toMatchObject({ storage: 'local', ffprobe: true });
    await t.http.get('/api/admin/system').set(bearer(owner.accessToken)).expect(403);
  });
});
