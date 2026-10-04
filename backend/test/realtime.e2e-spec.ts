import {
  DeviceClient,
  TestApp,
  adminLogin,
  bearer,
  createTestApp,
  registerDevice,
} from './helpers';

/**
 * Uçtan uca cihaz akışı: kayıt (gizli anahtar) → WS el sıkışması → eşleştirme
 * → ekran atama → SCREEN_PATCH → REQUEST_SCREEN → silmede SCREEN_CLEAR.
 */
describe('Cihaz ve gerçek zaman akışı', () => {
  let t: TestApp;
  let token: string;

  beforeAll(async () => {
    t = await createTestApp();
    token = await adminLogin(t);
  });
  afterAll(() => t.close());

  async function createScreen(data: Record<string, unknown> = {}) {
    const res = await t.http
      .post('/api/screens')
      .set(bearer(token))
      .send({ name: 'Test', template: 'info-board', data })
      .expect(201);
    return res.body as { id: string };
  }

  async function pairAndGetId(deviceId: string): Promise<string> {
    const res = await t.http
      .post('/api/devices/pair')
      .set(bearer(token))
      .send({ deviceId })
      .expect(201);
    return res.body.id;
  }

  it('kayıt gizli anahtarı yalnızca ilk seferde verir; anahtarsız yeniden kayıt reddedilir', async () => {
    const first = await t.http
      .post('/api/devices/register')
      .send({ deviceId: 'DEVREG01' })
      .expect(201);
    expect(first.body.secret).toHaveLength(64);
    expect(first.body.panelUrl).toBe('http://panel.test');

    // Device ID'yi bilen başka biri anahtarsız kayıt olamaz (cihazı ele geçiremez).
    await t.http.post('/api/devices/register').send({ deviceId: 'DEVREG01' }).expect(409);
    await t.http
      .post('/api/devices/register')
      .send({ deviceId: 'DEVREG01', secret: 'x'.repeat(64) })
      .expect(409);

    const again = await t.http
      .post('/api/devices/register')
      .send({ deviceId: 'DEVREG01', secret: first.body.secret, appVersion: 2 })
      .expect(201);
    expect(again.body.secret).toBeUndefined();
  });

  it('WS: anahtarsız 4003, eski protokol 4010, kayıtsız cihaz 4004 ile kapanır', async () => {
    const secret = await registerDevice(t, 'DEVWS001');

    const noSecret = DeviceClient.connect(t, { deviceId: 'DEVWS001' });
    expect((await noSecret.closed).code).toBe(4003);

    const oldProto = DeviceClient.connect(t, { deviceId: 'DEVWS001', secret, proto: 0 });
    expect((await oldProto.closed).code).toBe(4010);

    const unknown = DeviceClient.connect(t, { deviceId: 'NOPE0000', secret });
    expect((await unknown.closed).code).toBe(4004);

    const ok = DeviceClient.connect(t, { deviceId: 'DEVWS001', secret });
    await ok.next('SCREEN_CLEAR'); // ekran atanmamış → pairing
    ok.close();
  });

  it('atama → SCREEN_ASSIGN, merge → SCREEN_PATCH, REQUEST_SCREEN → SCREEN_UPDATE, silme → SCREEN_CLEAR', async () => {
    const secret = await registerDevice(t, 'DEVFLOW1');
    const device = DeviceClient.connect(t, { deviceId: 'DEVFLOW1', secret });
    await device.next('SCREEN_CLEAR');

    const id = await pairAndGetId('DEVFLOW1');
    const screen = await createScreen({ blocks: [] });
    await t.http
      .post(`/api/devices/${id}/assign-screen`)
      .set(bearer(token))
      .send({ screenId: screen.id })
      .expect(201);
    const assigned = await device.next('SCREEN_ASSIGN');
    expect(assigned.payload.id).toBe(screen.id);

    await t.http
      .patch(`/api/screens/${screen.id}`)
      .set(bearer(token))
      .send({ merge: { title: 'Yeni' } })
      .expect(200);
    const patch = await device.next('SCREEN_PATCH');
    expect(patch.payload.base).toBe(assigned.payload.updatedAt);
    expect(patch.payload.patch).toEqual([{ op: 'add', path: '/title', value: 'Yeni' }]);

    device.send({ type: 'REQUEST_SCREEN' });
    const full = await device.next('SCREEN_UPDATE');
    expect(full.payload.data.title).toBe('Yeni');

    await t.http.delete(`/api/screens/${screen.id}`).set(bearer(token)).expect(200);
    await device.next('SCREEN_CLEAR');

    // Silinen ekranın ataması FK ile boşalır.
    const after = await t.http.get(`/api/devices/${id}`).set(bearer(token)).expect(200);
    expect(after.body.currentScreenId).toBeNull();
    device.close();
  });

  it('ekranı olan cihaza yeni ekran atanınca kalıcı olur ve patch yeni ekrandan gelir', async () => {
    const secret = await registerDevice(t, 'DEVREAS1');
    const device = DeviceClient.connect(t, { deviceId: 'DEVREAS1', secret });
    await device.next('SCREEN_CLEAR');
    const id = await pairAndGetId('DEVREAS1');
    const first = await createScreen();
    const second = await createScreen();

    for (const screen of [first, second]) {
      await t.http
        .post(`/api/devices/${id}/assign-screen`)
        .set(bearer(token))
        .send({ screenId: screen.id })
        .expect(201);
      expect((await device.next('SCREEN_ASSIGN')).payload.id).toBe(screen.id);
      // Atama veritabanına yazılmış olmalı (yalnızca mesaj değil).
      const stored = await t.http.get(`/api/devices/${id}`).set(bearer(token)).expect(200);
      expect(stored.body.currentScreenId).toBe(screen.id);
    }

    await t.http
      .patch(`/api/screens/${second.id}`)
      .set(bearer(token))
      .send({ merge: { title: 'İkinci' } })
      .expect(200);
    expect((await device.next('SCREEN_PATCH')).payload.screenId).toBe(second.id);

    // Grup ve ekran kaldırma da ilişkili kayıtta kalıcı olmalı.
    const group = await t.http.post('/api/groups').set(bearer(token)).send({ name: 'G' }).expect(201);
    await t.http.patch(`/api/devices/${id}`).set(bearer(token)).send({ groupId: group.body.id }).expect(200);
    await t.http.delete(`/api/devices/${id}/screen`).set(bearer(token)).expect(200);
    const after = await t.http.get(`/api/devices/${id}`).set(bearer(token)).expect(200);
    expect(after.body.groupId).toBe(group.body.id);
    expect(after.body.currentScreenId).toBeNull();
    device.close();
  });

  it('cihaz panelden silinince SCREEN_CLEAR alır', async () => {
    const secret = await registerDevice(t, 'DEVDEL01');
    const device = DeviceClient.connect(t, { deviceId: 'DEVDEL01', secret });
    await device.next('SCREEN_CLEAR');
    const id = await pairAndGetId('DEVDEL01');
    await t.http.delete(`/api/devices/${id}`).set(bearer(token)).expect(200);
    await device.next('SCREEN_CLEAR');
    device.close();
  });

  it('yeniden bağlanma yarışı: yeni bağlantı eskisini kapatır, eskinin kapanması yenisini silmez', async () => {
    const secret = await registerDevice(t, 'DEVRACE1');
    const id = await pairAndGetId('DEVRACE1');
    const screen = await createScreen();

    const old = DeviceClient.connect(t, { deviceId: 'DEVRACE1', secret });
    await old.next('SCREEN_CLEAR');
    const fresh = DeviceClient.connect(t, { deviceId: 'DEVRACE1', secret });
    await fresh.next('SCREEN_CLEAR');
    expect((await old.closed).code).toBe(4001);

    // Eski soket kapandıktan sonra da güncellemeler yeni bağlantıya ulaşır.
    await t.http
      .post(`/api/devices/${id}/assign-screen`)
      .set(bearer(token))
      .send({ screenId: screen.id })
      .expect(201);
    await fresh.next('SCREEN_ASSIGN');
    const status = await t.http.get(`/api/devices/${id}`).set(bearer(token)).expect(200);
    expect(status.body.status).toBe('online');
    fresh.close();
  });
});
