import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';
import { OrganizationsService, hashToken } from '../organizations/organizations.service';
import { MailService } from '../mail/mail.service';
import { RefreshToken } from './refresh-token.entity';
import { PasswordReset } from './password-reset.entity';
import { AuthUser } from './current-user.decorator';
import { JwtPayload } from './jwt.strategy';
import { AcceptInvitationDto, LoginDto, RegisterDto } from './dto/auth.dto';
import {
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  generateSecret,
  hashCode,
  otpauthUrl,
  verifyTotp,
} from './totp/totp';

export interface SessionMeta {
  userAgent?: string;
}

/** Panelin sakladığı oturum: kısa ömürlü erişim jetonu + dönen yenileme jetonu. */
export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name: string | null; role: User['role']; twoFactorEnabled: boolean };
  organization: { id: string; name: string; role: string } | null;
  organizations: Awaited<ReturnType<OrganizationsService['membershipsOf']>>;
}

export type LoginResult = Session | { twoFactorRequired: true; challenge: string };

const RESET_TTL_MS = 60 * 60 * 1000;
// Kullanıcı yokken de bcrypt çalıştırılır (yanıt süresiyle hesap varlığı sızmasın).
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly orgs: OrganizationsService,
    private readonly mail: MailService,
    @InjectRepository(RefreshToken) private readonly refreshTokens: Repository<RefreshToken>,
    @InjectRepository(PasswordReset) private readonly resets: Repository<PasswordReset>,
  ) {}

  private get appSecret(): string {
    return this.config.getOrThrow<string>('JWT_SECRET');
  }

  private get panelUrl(): string {
    return (this.config.get<string>('PANEL_URL') || '').replace(/\/$/, '');
  }

  // --- Kurulum / kayıt ---

  async setupStatus() {
    return { needsSetup: (await this.users.count()) === 0 };
  }

  /** Public kayıt yalnızca ilk kullanıcı (kurulum) için açık; o da superadmin olur. */
  async register(dto: RegisterDto, meta: SessionMeta): Promise<Session> {
    if ((await this.users.count()) > 0) {
      throw new ForbiddenException('Registration is closed — contact your administrator');
    }
    const email = dto.email.trim().toLowerCase();
    if (await this.users.findByEmail(email)) throw new ConflictException('This email is already registered');

    const user = await this.users.create({
      email,
      passwordHash: await bcrypt.hash(dto.password, 10),
      name: dto.name,
      role: 'superadmin',
    });
    const org = await this.orgs.createPersonalOrg(user);
    return this.startSession(user, org.id, meta);
  }

  // --- Giriş ---

  async login(dto: LoginDto, meta: SessionMeta): Promise<LoginResult> {
    const user = await this.users.findByEmail(dto.email.trim().toLowerCase());
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !ok) throw new UnauthorizedException('Invalid email or password');

    if (user.totpEnabled) {
      return {
        twoFactorRequired: true,
        challenge: this.jwt.sign(
          { sub: user.id, purpose: '2fa' },
          { expiresIn: '5m' },
        ),
      };
    }
    return this.startSession(user, await this.defaultOrgId(user), meta);
  }

  async loginTwoFactor(challenge: string, code: string, meta: SessionMeta): Promise<Session> {
    let payload: { sub: string; purpose?: string };
    try {
      payload = this.jwt.verify(challenge);
    } catch {
      throw new UnauthorizedException('Verification expired, please sign in again');
    }
    if (payload.purpose !== '2fa') throw new UnauthorizedException();
    const user = await this.users.findById(payload.sub);
    if (!user?.totpEnabled) throw new UnauthorizedException();
    if (!(await this.checkSecondFactor(user, code))) {
      throw new UnauthorizedException('Invalid verification code');
    }
    return this.startSession(user, await this.defaultOrgId(user), meta);
  }

  /** TOTP kodu ya da (tek kullanımlık) kurtarma kodu. */
  private async checkSecondFactor(user: User, code: string): Promise<boolean> {
    if (!user.totpSecretEnc) return false;
    const clean = code.trim();
    if (/^\d{6}$/.test(clean.replace(/\s/g, ''))) {
      return verifyTotp(decryptSecret(user.totpSecretEnc, this.appSecret), clean);
    }
    const hash = hashCode(clean);
    const codes = user.recoveryCodes ?? [];
    if (!codes.includes(hash)) return false;
    await this.users.setTwoFactor(user.id, {
      recoveryCodes: codes.filter((c) => c !== hash),
    });
    return true;
  }

  private async defaultOrgId(user: User): Promise<string | null> {
    const memberships = await this.orgs.membershipsOf(user.id);
    return memberships[0]?.organizationId ?? null;
  }

  // --- Oturum / jetonlar ---

  private async buildSession(user: User, orgId: string | null, refreshToken: string): Promise<Session> {
    const memberships = await this.orgs.membershipsOf(user.id);
    const active = memberships.find((m) => m.organizationId === orgId) ?? memberships[0] ?? null;
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      org: active?.organizationId ?? null,
      tv: user.tokenVersion,
    };
    return {
      accessToken: this.jwt.sign(payload),
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        role: user.role,
        twoFactorEnabled: user.totpEnabled,
      },
      organization: active
        ? { id: active.organizationId, name: active.organizationName, role: active.role }
        : null,
      organizations: memberships,
    };
  }

  private newRefreshToken(
    user: User,
    orgId: string | null,
    meta: SessionMeta,
    familyId: string = randomUUID(),
  ): Promise<{ raw: string; entity: RefreshToken }> {
    const raw = randomBytes(32).toString('hex');
    const days = Number(this.config.get('REFRESH_TTL_DAYS') ?? 30);
    return this.refreshTokens
      .save(
        this.refreshTokens.create({
          userId: user.id,
          tokenHash: hashToken(raw),
          familyId,
          organizationId: orgId,
          userAgent: meta.userAgent?.slice(0, 200) ?? null,
          expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        }),
      )
      .then((entity) => ({ raw, entity }));
  }

  private async startSession(user: User, orgId: string | null, meta: SessionMeta): Promise<Session> {
    const { raw } = await this.newRefreshToken(user, orgId, meta);
    return this.buildSession(user, orgId, raw);
  }

  /**
   * Yenileme jetonunu döndürür (rotation). İptal edilmiş jeton tekrar gelirse
   * çalınma şüphesiyle o oturum ailesi tamamen iptal edilir.
   */
  async refresh(raw: string, meta: SessionMeta, switchToOrgId?: string): Promise<Session> {
    const token = await this.refreshTokens.findOne({ where: { tokenHash: hashToken(raw) } });
    if (!token) throw new UnauthorizedException('Session is invalid');
    if (token.revokedAt) {
      await this.revokeFamily(token.familyId);
      throw new UnauthorizedException('Session is invalid');
    }
    if (token.expiresAt.getTime() < Date.now()) throw new UnauthorizedException('Session expired');

    const user = await this.users.findById(token.userId);
    if (!user) throw new UnauthorizedException('Session is invalid');

    let orgId = token.organizationId ?? null;
    if (switchToOrgId) {
      if (!(await this.orgs.findMembership(user.id, switchToOrgId))) {
        throw new ForbiddenException('You are not a member of this organization');
      }
      orgId = switchToOrgId;
    }

    token.revokedAt = new Date();
    await this.refreshTokens.save(token);
    const next = await this.newRefreshToken(user, orgId, meta, token.familyId);
    return this.buildSession(user, orgId, next.raw);
  }

  async switchOrg(raw: string, organizationId: string, meta: SessionMeta): Promise<Session> {
    return this.refresh(raw, meta, organizationId);
  }

  private revokeFamily(familyId: string) {
    return this.refreshTokens.update({ familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async logout(raw: string): Promise<void> {
    const token = await this.refreshTokens.findOne({ where: { tokenHash: hashToken(raw) } });
    if (token) await this.revokeFamily(token.familyId);
  }

  /** Tüm cihazlardaki oturumları kapatır: yenileme jetonları iptal + eski erişim jetonları geçersiz. */
  async logoutAll(userId: string): Promise<void> {
    await this.users.bumpTokenVersion(userId);
    await this.refreshTokens.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  async me(authUser: AuthUser): Promise<Omit<Session, 'accessToken' | 'refreshToken'>> {
    const user = await this.users.findById(authUser.id);
    if (!user) throw new UnauthorizedException();
    const { accessToken: _a, refreshToken: _r, ...rest } = await this.buildSession(user, authUser.orgId, '');
    return rest;
  }

  // --- Parola ---

  /** Her zaman aynı yanıt (hesap var mı sızdırılmaz). */
  async forgotPassword(emailRaw: string): Promise<void> {
    const user = await this.users.findByEmail(emailRaw.trim().toLowerCase());
    if (!user) return;
    await this.resets.delete({ userId: user.id, usedAt: IsNull() });
    const token = randomBytes(24).toString('hex');
    await this.resets.save(
      this.resets.create({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      }),
    );
    await this.mail.send({
      to: user.email,
      subject: 'Password reset',
      text:
        `Reset your password: ${this.panelUrl}/reset-password?token=${token}\n\n` +
        `The link is valid for 1 hour. If you did not request this, ignore this email.`,
    });
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const row = await this.resets.findOne({ where: { tokenHash: hashToken(token) } });
    if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('The link is invalid or has expired');
    }
    row.usedAt = new Date();
    await this.resets.save(row);
    await this.users.updateProfile(row.userId, { passwordHash: await bcrypt.hash(password, 10) });
    await this.logoutAll(row.userId);
  }

  async changePassword(
    authUser: AuthUser,
    currentPassword: string,
    newPassword: string,
    meta: SessionMeta,
  ): Promise<Session> {
    const user = await this.users.findById(authUser.id);
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    await this.users.updateProfile(user.id, { passwordHash: await bcrypt.hash(newPassword, 10) });
    await this.logoutAll(user.id);
    // Diğer oturumlar kapandı; bu cihaz yeni oturumla devam eder.
    const fresh = (await this.users.findById(user.id))!;
    return this.startSession(fresh, authUser.orgId, meta);
  }

  // --- Davet kabulü ---

  async invitationInfo(token: string) {
    const inv = await this.orgs.findValidInvitation(token);
    const exists = !!(await this.users.findByEmail(inv.email));
    return {
      organizationName: inv.organization.name,
      email: inv.email,
      role: inv.role,
      userExists: exists,
    };
  }

  /**
   * Hesabı olan davetli giriş yapmış (aynı e-posta) olmalı; hesabı olmayan
   * parola belirleyerek hesap oluşturur. Her iki durumda üyelik açılır.
   */
  async acceptInvitation(
    dto: AcceptInvitationDto,
    authUser: AuthUser | null,
    meta: SessionMeta,
  ): Promise<Session> {
    const inv = await this.orgs.findValidInvitation(dto.token);
    let user = await this.users.findByEmail(inv.email);

    if (user) {
      if (!authUser || authUser.id !== user.id) {
        throw new UnauthorizedException(`Sign in as ${inv.email} to accept the invitation`);
      }
    } else {
      if (!dto.password) throw new BadRequestException('Choose a password to create your account');
      user = await this.users.create({
        email: inv.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name: dto.name,
        role: 'user',
      });
    }
    await this.orgs.consumeInvitation(inv, user.id);
    return this.startSession(user, inv.organizationId, meta);
  }

  // --- 2FA (TOTP) ---

  /** Yeni gizli anahtar üretir (henüz etkin değil); kullanıcı uygulamasına ekleyip kodu doğrular. */
  async twoFactorSetup(authUser: AuthUser) {
    const user = await this.users.findById(authUser.id);
    if (!user) throw new NotFoundException();
    if (user.totpEnabled) throw new ConflictException('Two-factor authentication is already enabled');
    const secret = generateSecret();
    await this.users.setTwoFactor(user.id, {
      totpSecretEnc: encryptSecret(secret, this.appSecret),
    });
    return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
  }

  /** Kodu doğrulayıp 2FA'yı açar; kurtarma kodları yalnızca burada bir kez gösterilir. */
  async twoFactorEnable(authUser: AuthUser, code: string) {
    const user = await this.users.findById(authUser.id);
    if (!user?.totpSecretEnc) throw new BadRequestException('Start the setup first');
    if (user.totpEnabled) throw new ConflictException('Two-factor authentication is already enabled');
    if (!verifyTotp(decryptSecret(user.totpSecretEnc, this.appSecret), code)) {
      throw new BadRequestException('Invalid verification code');
    }
    const recoveryCodes = generateRecoveryCodes();
    await this.users.setTwoFactor(user.id, {
      totpEnabled: true,
      recoveryCodes: recoveryCodes.map(hashCode),
    });
    return { recoveryCodes };
  }

  async twoFactorDisable(authUser: AuthUser, password: string, code: string): Promise<void> {
    const user = await this.users.findById(authUser.id);
    if (!user?.totpEnabled) throw new BadRequestException('Two-factor authentication is not enabled');
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Incorrect password');
    }
    if (!(await this.checkSecondFactor(user, code))) {
      throw new UnauthorizedException('Invalid verification code');
    }
    await this.users.setTwoFactor(user.id, {
      totpEnabled: false,
      totpSecretEnc: null,
      recoveryCodes: null,
    });
  }
}
