import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { Organization, OrgLimits } from './organization.entity';
import { Membership, ORG_ROLES, OrgRole } from './membership.entity';
import { Invitation } from './invitation.entity';
import { User } from '../users/user.entity';
import { LimitsService } from './limits.service';
import { MailService } from '../mail/mail.service';
import { AuthUser } from '../auth/current-user.decorator';
import { EventBusService } from '../events/event-bus.service';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex');

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export interface MemberView {
  userId: string;
  email: string;
  name: string | null;
  role: OrgRole;
  joinedAt: Date;
}

export interface MembershipView {
  organizationId: string;
  organizationName: string;
  role: OrgRole;
}

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Membership) private readonly members: Repository<Membership>,
    @InjectRepository(Invitation) private readonly invitations: Repository<Invitation>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly limits: LimitsService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
    private readonly bus: EventBusService,
  ) {}

  // --- Oluşturma / üyelikler ---

  /** Organizasyon oluşturur ve kullanıcıyı sahibi (owner) yapar. */
  async createWithOwner(userId: string, name: string): Promise<Organization> {
    const org = await this.orgs.save(this.orgs.create({ name }));
    await this.members.save(this.members.create({ organizationId: org.id, userId, role: 'owner' }));
    return org;
  }

  /** Yeni kullanıcı için kişisel organizasyon. */
  createPersonalOrg(user: Pick<User, 'id' | 'email' | 'name'>): Promise<Organization> {
    const base = user.name?.trim() || user.email.split('@')[0];
    return this.createWithOwner(user.id, `${base}'s organization`);
  }

  async membershipsOf(userId: string): Promise<MembershipView[]> {
    const rows = await this.members.find({
      where: { userId },
      relations: { organization: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((m) => ({
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      role: m.role,
    }));
  }

  findMembership(userId: string, orgId: string): Promise<Membership | null> {
    return this.members.findOne({ where: { userId, organizationId: orgId } });
  }

  async getOrThrow(orgId: string): Promise<Organization> {
    const org = await this.orgs.findOne({ where: { id: orgId } });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  // --- Detay (sahip/üye görünümü) ---

  async detail(orgId: string) {
    const [org, limits, usage, members, invitations] = await Promise.all([
      this.getOrThrow(orgId),
      this.limits.effective(orgId),
      this.limits.usage(orgId),
      this.members.find({
        where: { organizationId: orgId },
        relations: { user: true },
        order: { createdAt: 'ASC' },
      }),
      this.invitations.find({
        where: { organizationId: orgId, acceptedAt: IsNull(), expiresAt: MoreThan(new Date()) },
        order: { createdAt: 'DESC' },
      }),
    ]);
    return {
      id: org.id,
      name: org.name,
      plan: org.plan,
      timezone: org.timezone,
      limits,
      usage,
      members: members.map(
        (m): MemberView => ({
          userId: m.userId,
          email: m.user.email,
          name: m.user.name ?? null,
          role: m.role,
          joinedAt: m.createdAt,
        }),
      ),
      invitations: invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        expiresAt: i.expiresAt,
      })),
    };
  }

  async updateSettings(orgId: string, patch: { name?: string; timezone?: string }): Promise<void> {
    const changes: Partial<Organization> = {};
    if (patch.name !== undefined) changes.name = patch.name.trim();
    if (patch.timezone !== undefined) {
      if (!isValidTimeZone(patch.timezone)) throw new BadRequestException('Unknown time zone');
      changes.timezone = patch.timezone;
    }
    if (Object.keys(changes).length) await this.orgs.update({ id: orgId }, changes);
    this.bus.notifyOrg(orgId, 'organization');
  }

  // --- Üye yönetimi ---

  private async ownerCount(orgId: string): Promise<number> {
    return this.members.count({ where: { organizationId: orgId, role: 'owner' } });
  }

  async setMemberRole(orgId: string, userId: string, role: OrgRole): Promise<void> {
    if (!ORG_ROLES.includes(role)) throw new BadRequestException('Invalid role');
    const m = await this.findMembership(userId, orgId);
    if (!m) throw new NotFoundException('Member not found');
    if (m.role === 'owner' && role !== 'owner' && (await this.ownerCount(orgId)) <= 1) {
      throw new BadRequestException('The last owner cannot be demoted — assign another owner first');
    }
    m.role = role;
    await this.members.save(m);
    this.bus.notifyOrg(orgId, 'organization');
  }

  /** Üyeyi çıkarır (sahip başkasını ya da kullanıcı kendi ayrılır). Son sahip çıkarılamaz. */
  async removeMember(actor: AuthUser, orgId: string, userId: string): Promise<void> {
    if (actor.id !== userId && actor.orgRole !== 'owner' && actor.role !== 'superadmin') {
      throw new ForbiddenException('Only an owner can remove members');
    }
    const m = await this.findMembership(userId, orgId);
    if (!m) throw new NotFoundException('Member not found');
    if (m.role === 'owner' && (await this.ownerCount(orgId)) <= 1) {
      throw new BadRequestException('The last owner cannot be removed — assign another owner first');
    }
    await this.members.remove(m);
    this.bus.notifyOrg(orgId, 'organization');
  }

  // --- Davetler ---

  /** Ham jeton yalnızca bu yanıtta döner; bağlantı panelde `/invite?token=` olarak kurulur. */
  async invite(actor: AuthUser, orgId: string, emailRaw: string, role: OrgRole) {
    const email = emailRaw.trim().toLowerCase();
    const org = await this.getOrThrow(orgId);

    const existingUser = await this.users.findOne({ where: { email } });
    if (existingUser && (await this.findMembership(existingUser.id, orgId))) {
      throw new ConflictException('This user is already a member');
    }
    // A pending invitation for the same email is replaced by the new one (same seat),
    // so the limit is only checked when this email has no pending invitation yet —
    // and always before the old one is deleted, so a refused invite loses nothing.
    const pending = await this.invitations.count({
      where: { organizationId: orgId, email, acceptedAt: IsNull(), expiresAt: MoreThan(new Date()) },
    });
    if (pending === 0) await this.limits.assertCanAdd(actor, orgId, 'members');
    await this.invitations.delete({ organizationId: orgId, email, acceptedAt: IsNull() });

    const token = randomBytes(24).toString('hex');
    const invitation = await this.invitations.save(
      this.invitations.create({
        organizationId: orgId,
        email,
        role,
        tokenHash: hashToken(token),
        invitedById: actor.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      }),
    );

    const panel = (this.config.get<string>('PANEL_URL') || '').replace(/\/$/, '');
    await this.mail.send({
      to: email,
      subject: `You have been invited to ${org.name}`,
      text:
        `${actor.email} invited you to join "${org.name}" as ${role}.\n\n` +
        `Accept the invitation: ${panel}/invite?token=${token}\n\n` +
        `The link is valid for 7 days.`,
    });
    this.bus.notifyOrg(orgId, 'organization');
    return { id: invitation.id, email, role, expiresAt: invitation.expiresAt, token };
  }

  async revokeInvitation(orgId: string, id: string): Promise<void> {
    const res = await this.invitations.delete({ id, organizationId: orgId });
    if (!res.affected) throw new NotFoundException('Invitation not found');
    this.bus.notifyOrg(orgId, 'organization');
  }

  /** Geçerli (kullanılmamış, süresi dolmamış) daveti jetonla bulur. */
  async findValidInvitation(token: string): Promise<Invitation> {
    const inv = await this.invitations.findOne({
      where: { tokenHash: hashToken(token) },
      relations: { organization: true },
    });
    if (!inv || inv.acceptedAt || inv.expiresAt.getTime() < Date.now()) {
      throw new NotFoundException('The invitation is invalid or has expired');
    }
    return inv;
  }

  /** Daveti kullanıcıya bağlar (üyelik oluşturur) ve daveti kapatır. */
  async consumeInvitation(inv: Invitation, userId: string): Promise<void> {
    const existing = await this.findMembership(userId, inv.organizationId);
    if (!existing) {
      await this.members.save(
        this.members.create({ organizationId: inv.organizationId, userId, role: inv.role }),
      );
    }
    inv.acceptedAt = new Date();
    await this.invitations.save(inv);
    this.bus.notifyOrg(inv.organizationId, 'organization');
  }

  /**
   * Kullanıcı silinmeden önce: tek üyesi olduğu organizasyonlar kaldırılır
   * (içindeki ekran/grup/API anahtarı da; cihazlar sahipsiz kalır). Başkalarının
   * da üye olduğu organizasyonda tek sahipse işlem reddedilir.
   */
  async handleUserDeletion(userId: string): Promise<void> {
    const mine = await this.members.find({ where: { userId } });
    for (const m of mine) {
      const total = await this.members.count({ where: { organizationId: m.organizationId } });
      if (total === 1) {
        await this.orgs.delete({ id: m.organizationId });
      } else if (m.role === 'owner' && (await this.ownerCount(m.organizationId)) <= 1) {
        throw new BadRequestException(
          'This user is the only owner of an organization that has other members — transfer ownership first',
        );
      }
    }
  }

  // --- Süper yönetici ---

  async listAll() {
    const orgs = await this.orgs.find({ order: { createdAt: 'ASC' } });
    const defaults = await this.limits.platformDefaults();
    return {
      defaults,
      organizations: await Promise.all(
        orgs.map(async (o) => ({
          id: o.id,
          name: o.name,
          plan: o.plan,
          timezone: o.timezone,
          limits: o.limits ?? {},
          effective: await this.limits.effective(o.id),
          usage: await this.limits.usage(o.id),
          createdAt: o.createdAt,
        })),
      ),
    };
  }

  async adminUpdate(
    orgId: string,
    patch: { name?: string; plan?: string; limits?: OrgLimits | null },
  ): Promise<void> {
    const org = await this.getOrThrow(orgId);
    if (patch.name !== undefined) org.name = patch.name;
    if (patch.plan !== undefined) org.plan = patch.plan;
    if (patch.limits !== undefined) org.limits = patch.limits;
    await this.orgs.save(org);
  }
}
