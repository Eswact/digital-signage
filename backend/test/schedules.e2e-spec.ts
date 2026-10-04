import http from 'http';
import { isActive, localParts, pickSchedule } from '../src/schedules/schedule.logic';
import { Schedule } from '../src/schedules/schedule.entity';
import { DeviceClient, TestApp, adminLogin, bearer, createTestApp, registerDevice } from './helpers';

const rule = (days: number[], startTime: string | null, endTime: string | null) => ({ days, startTime, endTime });
const at = (iso: string) => new Date(iso);

describe('Zamanlama kuralları (saf mantık)', () => {
  it('saat dilimine göre yerel gün/saat hesaplar', () => {
    // 2026-10-05 Pazartesi 22:30 UTC = Salı 01:30 İstanbul (UTC+3)
    expect(localParts(at('2026-10-05T22:30:00Z'), 'UTC')).toEqual({ day: 1, minutes: 22 * 60 + 30 });
    expect(localParts(at('2026-10-05T22:30:00Z'), 'Europe/Istanbul')).toEqual({ day: 2, minutes: 90 });
  });

  it('gün içi aralık: başlangıç dahil, bitiş hariç; günler dışında kapalı', () => {
    const r = rule([1], '09:00', '17:00'); // Pazartesi
    expect(isActive(r, at('2026-10-05T09:00:00Z'), 'UTC')).toBe(true);
    expect(isActive(r, at('2026-10-05T16:59:00Z'), 'UTC')).toBe(true);
    expect(isActive(r, at('2026-10-05T17:00:00Z'), 'UTC')).toBe(false);
    expect(isActive(r, at('2026-10-06T10:00:00Z'), 'UTC')).toBe(false);
  });

  it('gece yarısını aşan aralık: akşam bugüne, sabah dünkü kurala ait', () => {
    const r = rule([5], '22:00', '06:00'); // Cuma gecesi
    expect(isActive(r, at('2026-10-09T23:00:00Z'), 'UTC')).toBe(true); // Cuma 23:00
    expect(isActive(r, at('2026-10-10T05:00:00Z'), 'UTC')).toBe(true); // Cumartesi 05:00 (dünkü kural)
    expect(isActive(r, at('2026-10-10T06:00:00Z'), 'UTC')).toBe(false);
    expect(isActive(r, at('2026-10-10T23:00:00Z'), 'UTC')).toBe(false); // Cumartesi gecesi kural değil
    expect(isActive(r, at('2026-10-09T10:00:00Z'), 'UTC')).toBe(false);
  });

  it('saat vermemek ya da başlangıç=bitiş tüm gün demektir', () => {
    expect(isActive(rule([1], null, null), at('2026-10-05T03:00:00Z'), 'UTC')).toBe(true);
    expect(isActive(rule([1], '08:00', '08:00'), at('2026-10-05T20:00:00Z'), 'UTC')).toBe(true);
    expect(isActive(rule([1], null, null), at('2026-10-06T03:00:00Z'), 'UTC')).toBe(false);
  });

  it('çakışmada öncelik, sonra cihaz>grup, sonra en yeni kazanır; devre dışı sayılmaz', () => {
    const mk = (over: Partial<Schedule>): Schedule =>
      ({ enabled: true, days: [0, 1, 2, 3, 4, 5, 6], startTime: null, endTime: null, priority: 0, createdAt: new Date(1000), ...over }) as Schedule;
    const device = { id: 'd1', groupId: 'g1' };
    const now = at('2026-10-05T12:00:00Z');
    const group = mk({ id: 'grp', targetType: 'group', targetId: 'g1', screenId: 'S-group' });
    const dev = mk({ id: 'dev', targetType: 'device', targetId: 'd1', screenId: 'S-device' });
    const high = mk({ id: 'hi', targetType: 'group', targetId: 'g1', screenId: 'S-high', priority: 5 });
    const off = mk({ id: 'off', targetType: 'device', targetId: 'd1', screenId: 'S-off', priority: 99, enabled: false });
    const foreign = mk({ id: 'x', targetType: 'device', targetId: 'other', screenId: 'S-x', priority: 50 });

    expect(pickSchedule([group, dev, off, foreign], device, now, 'UTC')?.screenId).toBe('S-device');
    expect(pickSchedule([group, dev, high], device, now, 'UTC')?.screenId).toBe('S-high');
    expect(pickSchedule([foreign, off], device, now, 'UTC')).toBeNull();
    const newer = mk({ id: 'new', targetType: 'group', targetId: 'g1', screenId: 'S-new', createdAt: new Date(5000) });
    expect(pickSchedule([group, newer], device, now, 'UTC')?.screenId).toBe('S-new');
  });
});

describe('Zamanlama: cihaza uçtan uca', () => {
  let t: TestApp;
  let token: string;

  beforeAll(async () => {
    t = await createTestApp();
    token = await adminLogin(t);
  });
  afterAll(() => t.close());

  const screen = async (name: string) =>
    (await t.http.post('/api/screens').set(bearer(token)).send({ name, template: 'info-board', data: {} }).expect(201)).body.id as string;

  it('etkin zamanlama temel ekranın yerine geçer; silinince/devre dışı kalınca temel ekrana dönülür', async () => {
    const secret = await registerDevice(t, 'DEVSCHD1');
    const device = DeviceClient.connect(t, { deviceId: 'DEVSCHD1', secret });
    await device.next('SCREEN_CLEAR');
    const id = (await t.http.post('/api/devices/pair').set(bearer(token)).send({ deviceId: 'DEVSCHD1' }).expect(201)).body.id;

    const base = await screen('Temel');
    const promo = await screen('Kampanya');
    await t.http.post(`/api/devices/${id}/assign-screen`).set(bearer(token)).send({ screenId: base }).expect(201);
    expect((await device.next('SCREEN_ASSIGN')).payload.id).toBe(base);

    // Tüm gün, her gün → hemen etkin.
    const created = await t.http
      .post('/api/schedules')
      .set(bearer(token))
      .send({ name: 'Her zaman', targetType: 'device', targetId: id, screenId: promo, days: [0, 1, 2, 3, 4, 5, 6] })
      .expect(201);
    expect((await device.next('SCREEN_ASSIGN')).payload.id).toBe(promo);

    const dev = (await t.http.get(`/api/devices/${id}`).set(bearer(token)).expect(200)).body;
    expect(dev.currentScreenId).toBe(base); // temel atama korunur
    expect(dev.activeScreenId).toBe(promo);
    const listed = (await t.http.get('/api/schedules').set(bearer(token)).expect(200)).body;
    expect(listed[0]).toMatchObject({ id: created.body.id, activeNow: true });

    // Etkin ekranın verisi güncellenince cihaza yama gelir.
    await t.http.patch(`/api/screens/${promo}`).set(bearer(token)).send({ merge: { note: 1 } }).expect(200);
    expect((await device.next('SCREEN_PATCH')).payload.screenId).toBe(promo);

    // Devre dışı → temel ekran geri gelir.
    await t.http.patch(`/api/schedules/${created.body.id}`).set(bearer(token)).send({ enabled: false }).expect(200);
    expect((await device.next('SCREEN_ASSIGN')).payload.id).toBe(base);
    await t.http.patch(`/api/schedules/${created.body.id}`).set(bearer(token)).send({ enabled: true }).expect(200);
    expect((await device.next('SCREEN_ASSIGN')).payload.id).toBe(promo);

    // Yeniden bağlanan cihaz doğrudan etkin ekranı alır.
    device.close();
    const again = DeviceClient.connect(t, { deviceId: 'DEVSCHD1', secret });
    expect((await again.next('SCREEN_UPDATE')).payload.id).toBe(promo);

    await t.http.delete(`/api/schedules/${created.body.id}`).set(bearer(token)).expect(200);
    expect((await again.next('SCREEN_ASSIGN')).payload.id).toBe(base);

    // Ekran silinince zamanlamalar da silinir ve cihaz temel ekranına döner.
    const second = await t.http
      .post('/api/schedules')
      .set(bearer(token))
      .send({ name: 'Ekran silinecek', targetType: 'device', targetId: id, screenId: promo, days: [0, 1, 2, 3, 4, 5, 6] })
      .expect(201);
    expect((await again.next('SCREEN_ASSIGN')).payload.id).toBe(promo);
    await t.http.delete(`/api/screens/${promo}`).set(bearer(token)).expect(200);
    expect((await again.next('SCREEN_ASSIGN')).payload.id).toBe(base);
    expect((await t.http.get('/api/schedules').set(bearer(token))).body.find((s: { id: string }) => s.id === second.body.id)).toBeUndefined();
    again.close();
  });

  it('grup zamanlaması gruptaki cihazlara uygulanır; doğrulama kuralları', async () => {
    const secret = await registerDevice(t, 'DEVSCHD2');
    const device = DeviceClient.connect(t, { deviceId: 'DEVSCHD2', secret });
    await device.next('SCREEN_CLEAR');
    const id = (await t.http.post('/api/devices/pair').set(bearer(token)).send({ deviceId: 'DEVSCHD2' }).expect(201)).body.id;
    const group = (await t.http.post('/api/groups').set(bearer(token)).send({ name: 'Şube' }).expect(201)).body.id;
    const promo = await screen('Grup kampanyası');

    const body = { name: 'Grup', targetType: 'group', targetId: group, screenId: promo, days: [0, 1, 2, 3, 4, 5, 6] };
    await t.http.post('/api/schedules').set(bearer(token)).send(body).expect(201);
    await t.http.patch(`/api/devices/${id}`).set(bearer(token)).send({ groupId: group }).expect(200);
    expect((await device.next('SCREEN_ASSIGN')).payload.id).toBe(promo);

    await t.http.post('/api/schedules').set(bearer(token)).send({ ...body, days: [] }).expect(400);
    await t.http.post('/api/schedules').set(bearer(token)).send({ ...body, days: [7] }).expect(400);
    await t.http.post('/api/schedules').set(bearer(token)).send({ ...body, startTime: '9:00', endTime: '17:00' }).expect(400);
    await t.http.post('/api/schedules').set(bearer(token)).send({ ...body, startTime: '09:00' }).expect(400);
    await t.http.post('/api/schedules').set(bearer(token)).send({ ...body, screenId: '00000000-0000-4000-8000-000000000000' }).expect(404);
    device.close();
  });

  it('organizasyon saat dilimi doğrulanır', async () => {
    await t.http.patch('/api/organization').set(bearer(token)).send({ timezone: 'Europe/Istanbul' }).expect(200);
    expect((await t.http.get('/api/organization').set(bearer(token))).body.timezone).toBe('Europe/Istanbul');
    await t.http.patch('/api/organization').set(bearer(token)).send({ timezone: 'Mars/Olympus' }).expect(400);
  });
});

describe('Canlı akış (SSE)', () => {
  let t: TestApp;
  let admin: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await adminLogin(t);
  });
  afterAll(() => t.close());

  /** /api/live akışını açar; gelen `change` olaylarını toplar. */
  function openStream(token: string) {
    const events: Array<{ type: string; id?: string }> = [];
    const waiters: Array<() => void> = [];
    let status = 0;
    const req = http.get(`${t.base}/api/live`, { headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } }, (res) => {
      status = res.statusCode ?? 0;
      res.setEncoding('utf8');
      let buf = '';
      res.on('data', (chunk: string) => {
        buf += chunk;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const block = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!/event: change/.test(block)) continue;
          const data = /data: (.*)/.exec(block)?.[1];
          if (data) events.push(JSON.parse(data));
          waiters.splice(0).forEach((w) => w());
        }
      });
    });
    return {
      get status() {
        return status;
      },
      events,
      waitFor: (pred: (e: { type: string; id?: string }) => boolean, ms = 3000) =>
        new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('event not received')), ms);
          const check = () => {
            if (events.some(pred)) {
              clearTimeout(timer);
              resolve();
            } else waiters.push(check);
          };
          check();
        }),
      close: () => req.destroy(),
    };
  }

  it('organizasyon değişikliklerini yalnızca kendi kullanıcılarına iletir', async () => {
    const owner = (await t.http.post('/api/users').set(bearer(admin)).send({ email: 'sse-a@test.local', password: 'password-123', role: 'user' }).expect(201), await t.http.post('/api/auth/login').send({ email: 'sse-a@test.local', password: 'password-123' })).body;
    const stranger = (await t.http.post('/api/users').set(bearer(admin)).send({ email: 'sse-b@test.local', password: 'password-123', role: 'user' }).expect(201), await t.http.post('/api/auth/login').send({ email: 'sse-b@test.local', password: 'password-123' })).body;

    const mine = openStream(owner.accessToken);
    const theirs = openStream(stranger.accessToken);
    await new Promise((r) => setTimeout(r, 200)); // akış açılsın
    expect(mine.status).toBe(200);

    const created = await t.http.post('/api/screens').set(bearer(owner.accessToken)).send({ name: 'Canlı', template: 'info-board' }).expect(201);
    await mine.waitFor((e) => e.type === 'screens' && e.id === created.body.id);

    await t.http.patch(`/api/screens/${created.body.id}`).set(bearer(owner.accessToken)).send({ merge: { a: 1 } }).expect(200);
    await mine.waitFor((e) => e.type === 'screen' && e.id === created.body.id);

    // Başka organizasyon hiçbir şey almamalı.
    expect(theirs.events).toEqual([]);

    // Kimliksiz bağlantı reddedilir.
    const anon = await new Promise<number>((resolve) => http.get(`${t.base}/api/live`, (res) => { resolve(res.statusCode ?? 0); res.destroy(); }));
    expect(anon).toBe(401);
    mine.close();
    theirs.close();
  });
});
