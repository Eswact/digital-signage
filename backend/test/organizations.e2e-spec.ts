import { DataSource } from 'typeorm';
import { MailService } from '../src/mail/mail.service';
import { UsersService } from '../src/users/users.service';
import { OrganizationBackfillService } from '../src/organizations/organization-backfill.service';
import { totp } from '../src/auth/totp/totp';
import { TestApp, adminLogin, bearer, createTestApp } from './helpers';

/** Davet/sıfırlama e-postasındaki jetonu (son `token=` değeri) çıkarır. */
function lastToken(t: TestApp): string {
  const outbox = t.app.get(MailService).outbox;
  const match = outbox[outbox.length - 1].text.match(/token=([0-9a-f]+)/);
  return match![1];
}

async function createUser(t: TestApp, admin: string, email: string, password = 'password-123') {
  await t.http
    .post('/api/users')
    .set(bearer(admin))
    .send({ email, password, role: 'user' })
    .expect(201);
}

async function loginSession(t: TestApp, email: string, password = 'password-123') {
  const res = await t.http.post('/api/auth/login').send({ email, password }).expect(201);
  return res.body as {
    accessToken: string;
    refreshToken: string;
    organization: { id: string; role: string };
  };
}

async function inviteAndAccept(
  t: TestApp,
  ownerToken: string,
  email: string,
  role: 'editor' | 'viewer',
) {
  await t.http
    .post('/api/organization/invitations')
    .set(bearer(ownerToken))
    .send({ email, role })
    .expect(201);
  const token = lastToken(t);
  const info = await t.http.post('/api/auth/invitation/info').send({ token }).expect(201);
  expect(info.body).toMatchObject({ email, role, userExists: false });
  const accepted = await t.http
    .post('/api/auth/invitation/accept')
    .send({ token, password: 'password-123', name: email.split('@')[0] })
    .expect(201);
  return accepted.body as { accessToken: string; organization: { id: string; role: string } };
}

describe('Organizasyon, roller, davet ve limitler', () => {
  let t: TestApp;
  let admin: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await adminLogin(t);
  });
  afterAll(() => t.close());

  it('davet → üyelik; roller yazma yetkisini belirler; organizasyonlar birbirinden izole', async () => {
    await createUser(t, admin, 'owner@test.local');
    await createUser(t, admin, 'other@test.local');
    const owner = await loginSession(t, 'owner@test.local');
    const other = await loginSession(t, 'other@test.local');
    expect(owner.organization.role).toBe('owner');
    expect(owner.organization.id).not.toBe(other.organization.id);

    const editor = await inviteAndAccept(t, owner.accessToken, 'editor@test.local', 'editor');
    const viewer = await inviteAndAccept(t, owner.accessToken, 'viewer@test.local', 'viewer');
    expect(editor.organization).toMatchObject({ id: owner.organization.id, role: 'editor' });

    // viewer okur ama yazamaz; editor içerik yazar ama üye yönetemez.
    await t.http.get('/api/screens').set(bearer(viewer.accessToken)).expect(200);
    await t.http
      .post('/api/screens')
      .set(bearer(viewer.accessToken))
      .send({ name: 'X', template: 'info-board' })
      .expect(403);
    const screen = await t.http
      .post('/api/screens')
      .set(bearer(editor.accessToken))
      .send({ name: 'Lobby', template: 'info-board' })
      .expect(201);
    await t.http
      .post('/api/organization/invitations')
      .set(bearer(editor.accessToken))
      .send({ email: 'z@test.local', role: 'viewer' })
      .expect(403);

    // Ekibin ekranı ekip içinde görünür, başka organizasyonda görünmez.
    await t.http.get(`/api/screens/${screen.body.id}`).set(bearer(viewer.accessToken)).expect(200);
    await t.http.get(`/api/screens/${screen.body.id}`).set(bearer(other.accessToken)).expect(404);

    const detail = await t.http.get('/api/organization').set(bearer(owner.accessToken)).expect(200);
    expect(detail.body.members.map((m: { email: string; role: string }) => [m.email, m.role])).toEqual(
      expect.arrayContaining([
        ['owner@test.local', 'owner'],
        ['editor@test.local', 'editor'],
        ['viewer@test.local', 'viewer'],
      ]),
    );

    // Kullanılmış davet tekrar kullanılamaz.
    await t.http
      .post('/api/auth/invitation/accept')
      .send({ token: lastToken(t), password: 'password-123' })
      .expect(404);
  });

  it('son sahip düşürülemez/çıkarılamaz; sahiplik devredilince mümkün olur', async () => {
    const owner = await loginSession(t, 'owner@test.local');
    const detail = await t.http.get('/api/organization').set(bearer(owner.accessToken)).expect(200);
    const byEmail = (e: string) =>
      detail.body.members.find((m: { email: string }) => m.email === e).userId as string;

    await t.http
      .patch(`/api/organization/members/${byEmail('owner@test.local')}`)
      .set(bearer(owner.accessToken))
      .send({ role: 'editor' })
      .expect(400);
    await t.http
      .delete(`/api/organization/members/${byEmail('owner@test.local')}`)
      .set(bearer(owner.accessToken))
      .expect(400);

    await t.http
      .patch(`/api/organization/members/${byEmail('editor@test.local')}`)
      .set(bearer(owner.accessToken))
      .send({ role: 'owner' })
      .expect(200);
    await t.http
      .patch(`/api/organization/members/${byEmail('owner@test.local')}`)
      .set(bearer(owner.accessToken))
      .send({ role: 'editor' })
      .expect(200);
    // Yeni rol anında geçerli (jeton eski olsa da rol her istekte DB'den okunur).
    await t.http
      .post('/api/organization/invitations')
      .set(bearer(owner.accessToken))
      .send({ email: 'late@test.local', role: 'viewer' })
      .expect(403);
  });

  it('plan limitleri: ekran limiti 403 LIMIT_REACHED, superadmin muaf; davet koltuğu sayar', async () => {
    const editor = await loginSession(t, 'editor@test.local');
    const orgId = editor.organization.id;

    await t.http
      .patch(`/api/admin/organizations/${orgId}`)
      .set(bearer(admin))
      .send({ limits: { maxScreens: 1, maxMembers: 4 } })
      .expect(200);

    // Önceki testte 1 ekran oluşturuldu → limit dolu.
    const blocked = await t.http
      .post('/api/screens')
      .set(bearer(editor.accessToken))
      .send({ name: 'Fazla', template: 'info-board' })
      .expect(403);
    expect(blocked.body).toMatchObject({ code: 'LIMIT_REACHED', resource: 'screens', limit: 1 });

    // 3 üye var (owner, editor, viewer); 4. koltuğu bekleyen davet tutar.
    await t.http
      .post('/api/organization/invitations')
      .set(bearer(editor.accessToken))
      .send({ email: 'a@test.local', role: 'viewer' })
      .expect(201);
    const full = await t.http
      .post('/api/organization/invitations')
      .set(bearer(editor.accessToken))
      .send({ email: 'b@test.local', role: 'viewer' })
      .expect(403);
    expect(full.body.code).toBe('LIMIT_REACHED');

    // Reddedilen davet mevcut bekleyen daveti silmemeli; aynı e-postayı yeniden davet etmek koltuk istemez.
    await t.http
      .post('/api/organization/invitations')
      .set(bearer(editor.accessToken))
      .send({ email: 'a@test.local', role: 'editor' })
      .expect(201);
    const detail = await t.http.get('/api/organization').set(bearer(editor.accessToken)).expect(200);
    expect(detail.body.invitations).toHaveLength(1);
    expect(detail.body.invitations[0]).toMatchObject({ email: 'a@test.local', role: 'editor' });
    expect(detail.body.usage).toMatchObject({ screens: 1, members: 4 });

    // Süper yönetici limitlere takılmaz.
    await t.http
      .post('/api/screens')
      .set(bearer(admin))
      .send({ name: 'Admin ekranı', template: 'info-board' })
      .expect(201);
  });

  it('organizasyon değiştirme yalnızca üyesi olunan organizasyona izin verir', async () => {
    const owner = await loginSession(t, 'other@test.local');
    const foreign = (await loginSession(t, 'editor@test.local')).organization.id;
    await t.http
      .post('/api/auth/switch-org')
      .send({ refreshToken: owner.refreshToken, organizationId: foreign })
      .expect(403);
  });
});

describe('Oturum jetonları ve parola', () => {
  let t: TestApp;
  let admin: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await adminLogin(t);
    await createUser(t, admin, 'sess@test.local');
  });
  afterAll(() => t.close());

  it('refresh jetonu döner; eski jeton yeniden gelirse oturum ailesi iptal olur', async () => {
    const s = await loginSession(t, 'sess@test.local');
    const next = await t.http.post('/api/auth/refresh').send({ refreshToken: s.refreshToken }).expect(201);
    expect(next.body.refreshToken).not.toBe(s.refreshToken);
    await t.http.get('/api/auth/me').set(bearer(next.body.accessToken)).expect(200);

    // Eski (kullanılmış) jeton → çalınma şüphesi: tüm aile iptal.
    await t.http.post('/api/auth/refresh').send({ refreshToken: s.refreshToken }).expect(401);
    await t.http.post('/api/auth/refresh').send({ refreshToken: next.body.refreshToken }).expect(401);
  });

  it('logout yalnızca o oturumu, logout-all tümünü ve eski erişim jetonlarını kapatır', async () => {
    const a = await loginSession(t, 'sess@test.local');
    const b = await loginSession(t, 'sess@test.local');

    await t.http.post('/api/auth/logout').send({ refreshToken: a.refreshToken }).expect(201);
    await t.http.post('/api/auth/refresh').send({ refreshToken: a.refreshToken }).expect(401);
    await t.http.post('/api/auth/refresh').send({ refreshToken: b.refreshToken }).expect(201);

    await t.http.post('/api/auth/logout-all').set(bearer(b.accessToken)).expect(201);
    await t.http.get('/api/auth/me').set(bearer(b.accessToken)).expect(401);
  });

  it('parola sıfırlama: hesap sızdırmaz, jeton tek kullanımlık, eski oturumlar kapanır', async () => {
    const mail = t.app.get(MailService);
    const before = await loginSession(t, 'sess@test.local');

    const unknown = await t.http.post('/api/auth/forgot-password').send({ email: 'yok@test.local' }).expect(201);
    expect(unknown.body).toEqual({ ok: true });
    const sent = mail.outbox.length;
    await t.http.post('/api/auth/forgot-password').send({ email: 'sess@test.local' }).expect(201);
    expect(mail.outbox).toHaveLength(sent + 1);
    const token = lastToken(t);

    await t.http.post('/api/auth/reset-password').send({ token, password: 'new-password-1' }).expect(201);
    await t.http.post('/api/auth/reset-password').send({ token, password: 'another-pass-1' }).expect(400);

    await t.http.get('/api/auth/me').set(bearer(before.accessToken)).expect(401);
    await t.http.post('/api/auth/refresh').send({ refreshToken: before.refreshToken }).expect(401);
    await t.http
      .post('/api/auth/login')
      .send({ email: 'sess@test.local', password: 'password-123' })
      .expect(401);
    await loginSession(t, 'sess@test.local', 'new-password-1');
  });
});

describe('İki adımlı doğrulama (TOTP)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
    await createUser(t, await adminLogin(t), 'twofa@test.local');
  });
  afterAll(() => t.close());

  it('kurulum → giriş meydan okuması → kurtarma kodu tek kullanımlık → kapatma', async () => {
    const s = await loginSession(t, 'twofa@test.local');
    const setup = await t.http.post('/api/auth/2fa/setup').set(bearer(s.accessToken)).expect(201);
    expect(setup.body.otpauthUrl).toContain('otpauth://totp/');

    await t.http
      .post('/api/auth/2fa/enable')
      .set(bearer(s.accessToken))
      .send({ code: '000000' })
      .expect(400);
    const enabled = await t.http
      .post('/api/auth/2fa/enable')
      .set(bearer(s.accessToken))
      .send({ code: totp(setup.body.secret) })
      .expect(201);
    const recovery: string[] = enabled.body.recoveryCodes;
    expect(recovery).toHaveLength(8);

    // Artık parola tek başına oturum vermez.
    const step1 = await t.http
      .post('/api/auth/login')
      .send({ email: 'twofa@test.local', password: 'password-123' })
      .expect(201);
    expect(step1.body.twoFactorRequired).toBe(true);
    expect(step1.body.accessToken).toBeUndefined();
    // Meydan okuma jetonu erişim jetonu olarak kabul edilmez.
    await t.http.get('/api/auth/me').set(bearer(step1.body.challenge)).expect(401);

    await t.http
      .post('/api/auth/login/2fa')
      .send({ challenge: step1.body.challenge, code: '111111' })
      .expect(401);
    const ok = await t.http
      .post('/api/auth/login/2fa')
      .send({ challenge: step1.body.challenge, code: totp(setup.body.secret) })
      .expect(201);
    await t.http.get('/api/auth/me').set(bearer(ok.body.accessToken)).expect(200);

    // Kurtarma kodu bir kez işe yarar.
    await t.http
      .post('/api/auth/login/2fa')
      .send({ challenge: step1.body.challenge, code: recovery[0] })
      .expect(201);
    await t.http
      .post('/api/auth/login/2fa')
      .send({ challenge: step1.body.challenge, code: recovery[0] })
      .expect(401);

    // Kapatmak için parola + kod gerekir.
    await t.http
      .post('/api/auth/2fa/disable')
      .set(bearer(ok.body.accessToken))
      .send({ password: 'yanlis-parola', code: totp(setup.body.secret) })
      .expect(401);
    await t.http
      .post('/api/auth/2fa/disable')
      .set(bearer(ok.body.accessToken))
      .send({ password: 'password-123', code: totp(setup.body.secret) })
      .expect(201);
    const plain = await t.http
      .post('/api/auth/login')
      .send({ email: 'twofa@test.local', password: 'password-123' })
      .expect(201);
    expect(plain.body.accessToken).toBeDefined();
  });
});

describe('Organizasyon taşıması (backfill)', () => {
  it('eski user_id verisini kullanıcının organizasyonuna bağlar ve ikinci çalıştırmada bir şey yapmaz', async () => {
    const t = await createTestApp();
    const ds = t.app.get(DataSource);
    const users = t.app.get(UsersService);
    const backfill = t.app.get(OrganizationBackfillService);

    // Üyeliği olmayan "eski" kullanıcı + ona ait sahipli kayıtlar.
    const legacy = await users.create({
      email: 'legacy@test.local',
      passwordHash: 'x',
      role: 'user',
    });
    await ds.query(
      `INSERT INTO screens (id, name, template, orientation, data, user_id) VALUES ('s-legacy', 'Old', 'info-board', 'landscape', '{}', ?)`,
      [legacy.id],
    );
    await ds.query(
      `INSERT INTO devices (id, device_id, status, user_id) VALUES ('d-legacy', 'LEGACY01', 'offline', ?)`,
      [legacy.id],
    );
    // Sahipsiz cihaz sahipsiz kalır.
    await ds.query(`INSERT INTO devices (id, device_id, status) VALUES ('d-free', 'FREE0001', 'offline')`);

    const first = await backfill.run();
    expect(first.orgsCreated).toBe(1);
    expect(first.rowsLinked).toBe(2);

    const [screen] = await ds.query(`SELECT organization_id FROM screens WHERE id = 's-legacy'`);
    const [device] = await ds.query(`SELECT organization_id FROM devices WHERE id = 'd-legacy'`);
    const [free] = await ds.query(`SELECT organization_id FROM devices WHERE id = 'd-free'`);
    expect(screen.organization_id).toBeTruthy();
    expect(device.organization_id).toBe(screen.organization_id);
    expect(free.organization_id).toBeNull();

    expect(await backfill.run()).toEqual({ orgsCreated: 0, rowsLinked: 0 });
    await t.close();
  });
});

describe('Yönetici parola değişimi', () => {
  it('başka kullanıcının parolasını değiştirmek eski oturumlarını kapatır', async () => {
    const t = await createTestApp();
    const admin = await adminLogin(t);
    await createUser(t, admin, 'victim@test.local');
    const before = await loginSession(t, 'victim@test.local');
    const users = await t.http.get('/api/users').set(bearer(admin)).expect(200);
    const id = users.body.find((u: { email: string }) => u.email === 'victim@test.local').id;

    await t.http.patch(`/api/users/${id}`).set(bearer(admin)).send({ password: 'changed-pass-1' }).expect(200);
    await t.http.get('/api/auth/me').set(bearer(before.accessToken)).expect(401);
    await t.http.post('/api/auth/refresh').send({ refreshToken: before.refreshToken }).expect(401);
    await loginSession(t, 'victim@test.local', 'changed-pass-1');
    await t.close();
  });
});
