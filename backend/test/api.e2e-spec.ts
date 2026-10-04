import { DataSource } from 'typeorm';
import { existsSync, rmSync } from 'fs';
import { databaseOptions } from '../src/database/data-source';
import { BackupService } from '../src/backup/backup.service';
import { TestApp, adminLogin, bearer, createTestApp, login } from './helpers';

describe('Auth, izolasyon, ingest', () => {
  let t: TestApp;
  let admin: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await adminLogin(t);
  });
  afterAll(() => t.close());

  it('kayıt yalnızca ilk kurulumda açık', async () => {
    const setup = await t.http.get('/api/auth/setup').expect(200);
    expect(setup.body.needsSetup).toBe(false);
    await t.http
      .post('/api/auth/register')
      .send({ email: 'x@test.local', password: 'password123' })
      .expect(403);
  });

  it('hesap izolasyonu: kullanıcı başkasının ekranını göremez, superadmin görür', async () => {
    await t.http
      .post('/api/users')
      .set(bearer(admin))
      .send({ email: 'user@test.local', password: 'user-password', role: 'user' })
      .expect(201);
    const user = await login(t, 'user@test.local', 'user-password');

    const own = await t.http
      .post('/api/screens')
      .set(bearer(user))
      .send({ name: 'Kullanıcı', template: 'order-board' })
      .expect(201);
    const adminScreen = await t.http
      .post('/api/screens')
      .set(bearer(admin))
      .send({ name: 'Yönetici', template: 'order-board' })
      .expect(201);

    await t.http.get(`/api/screens/${adminScreen.body.id}`).set(bearer(user)).expect(404);
    await t.http.get(`/api/screens/${own.body.id}`).set(bearer(admin)).expect(200);
    const list = await t.http.get('/api/screens').set(bearer(user)).expect(200);
    expect(list.body.map((s: { id: string }) => s.id)).toEqual([own.body.id]);

    // Başkasının ekranına API anahtarı da açılamaz.
    await t.http
      .post(`/api/screens/${adminScreen.body.id}/keys`)
      .set(bearer(user))
      .send({ name: 'x' })
      .expect(404);
  });

  it('API anahtarı yalnızca oluşturulurken görünür; ingest uçları anahtarla çalışır', async () => {
    const screen = await t.http
      .post('/api/screens')
      .set(bearer(admin))
      .send({
        name: 'Pano',
        template: 'order-board',
        data: { columns: [{ id: 'prep', title: 'Hazırlanıyor' }], orders: [] },
      })
      .expect(201);
    const created = await t.http
      .post(`/api/screens/${screen.body.id}/keys`)
      .set(bearer(admin))
      .send({ name: 'Kasa' })
      .expect(201);
    const key: string = created.body.key;
    expect(key).toMatch(/^sk_[0-9a-f]{48}$/);
    expect(created.body.keyHash).toBeUndefined();

    const list = await t.http
      .get(`/api/screens/${screen.body.id}/keys`)
      .set(bearer(admin))
      .expect(200);
    expect(list.body[0].key).toBeUndefined();
    expect(list.body[0].keyHash).toBeUndefined();
    expect(list.body[0].prefix).toBe(key.slice(0, 11));

    await t.http
      .post('/api/ingest/orders')
      .set('X-API-Key', key)
      .send({ code: '42', columnId: 'prep' })
      .expect(201);
    await t.http
      .post('/api/ingest/orders')
      .set('X-API-Key', key)
      .send({ code: '43', columnId: 'yok' })
      .expect(400);
    // Yanlış şablon: sipariş panosu anahtarıyla sıra ucu çalışmaz.
    await t.http.post('/api/ingest/queue/next').set('X-API-Key', key).expect(400);
    await t.http.get('/api/ingest/state').set('X-API-Key', 'sk_yanlis').expect(401);

    const state = await t.http.get('/api/ingest/state').set('X-API-Key', key).expect(200);
    expect(state.body.orders.map((o: { code: string }) => o.code)).toEqual(['42']);
  });

  it('sıra numarası: next/prev/items önek ve sıfır dolgusunu korur', async () => {
    const screen = await t.http
      .post('/api/screens')
      .set(bearer(admin))
      .send({ name: 'Sıra', template: 'queue-number', data: { current: 'A009' } })
      .expect(201);
    const { key } = (
      await t.http
        .post(`/api/screens/${screen.body.id}/keys`)
        .set(bearer(admin))
        .send({ name: 'Sıramatik' })
        .expect(201)
    ).body;
    const K = { 'X-API-Key': key };

    expect((await t.http.post('/api/ingest/queue/next').set(K).expect(201)).body.current).toBe('A010');
    expect((await t.http.post('/api/ingest/queue/prev').set(K).expect(201)).body.current).toBe('A009');
    const item = await t.http.post('/api/ingest/queue/items').set(K).send({ name: 'Ayşe' }).expect(201);
    expect(item.body.number).toBe('A010');
    const called = await t.http.post('/api/ingest/queue/next').set(K).expect(201);
    expect(called.body).toMatchObject({ current: 'A010', currentName: 'Ayşe', queue: [] });
  });

  it('login rate limit: dakikada 10 denemeden sonra 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) {
      const res = await t.http
        .post('/api/auth/login')
        .send({ email: 'yok@test.local', password: 'yanlis-parola' });
      codes.push(res.status);
    }
    // Aynı dakikadaki önceki login'ler de sayılır → 429 en geç 11. denemede.
    const first429 = codes.indexOf(429);
    expect(first429).toBeGreaterThan(0);
    expect(codes.slice(0, first429).every((c) => c === 401)).toBe(true);
  });
});

describe('Yedek', () => {
  it('çalışan veritabanının tutarlı kopyasını alır', async () => {
    const t = await createTestApp();
    const file = await t.app.get(BackupService).run();
    expect(existsSync(file)).toBe(true);
    await t.close();
    rmSync(process.env.BACKUP_DIR!, { recursive: true, force: true });
  });
});

describe('Migration', () => {
  it('boş veritabanında şemayı kurar ve entity\'lerle birebir uyumludur', async () => {
    const ds = new DataSource({
      ...databaseOptions({ NODE_ENV: 'production', DB_FILE: ':memory:' }),
      migrationsRun: false,
    });
    await ds.initialize();
    await ds.runMigrations();
    // Migration sonrası entity'lere göre yapılacak şema değişikliği kalmamalı.
    const pending = await ds.driver.createSchemaBuilder().log();
    expect(pending.upQueries.map((q) => q.query)).toEqual([]);
    await ds.destroy();
  });
});
