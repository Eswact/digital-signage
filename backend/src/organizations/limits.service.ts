import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization, OrgLimits } from './organization.entity';
import { Membership } from './membership.entity';
import { Invitation } from './invitation.entity';
import { Screen } from '../screens/screen.entity';
import { Device } from '../devices/device.entity';
import { MediaAsset } from '../media/media-asset.entity';
import { SettingsService } from '../settings/settings.service';
import { AuthUser } from '../auth/current-user.decorator';

export type LimitResource = 'screens' | 'devices' | 'members' | 'media';

/** Platform defaults; the superadmin overrides them via the 'limits' setting, per organization via `limits`. */
export const DEFAULT_LIMITS: Required<OrgLimits> = {
  maxScreens: 25,
  maxDevices: 25,
  maxMembers: 10,
  storageQuotaMb: 512,
  maxMediaFiles: 200,
  maxVideoSeconds: 120,
  maxUploadMb: 100,
};

const LABEL: Record<LimitResource, string> = {
  screens: 'screens',
  devices: 'devices',
  members: 'members',
  media: 'media files',
};

export interface OrgUsage {
  screens: number;
  devices: number;
  /** Members + pending invitations (an invitation reserves a seat). */
  members: number;
  mediaFiles: number;
  /** Media storage in bytes. */
  storageBytes: number;
}

const MB = 1024 * 1024;

function limitReached(message: string, resource: string, limit: number): HttpException {
  return new HttpException(
    { message, code: 'LIMIT_REACHED', resource, limit },
    HttpStatus.FORBIDDEN,
  );
}

@Injectable()
export class LimitsService {
  constructor(
    @InjectRepository(Organization) private readonly orgs: Repository<Organization>,
    @InjectRepository(Screen) private readonly screens: Repository<Screen>,
    @InjectRepository(Device) private readonly devices: Repository<Device>,
    @InjectRepository(Membership) private readonly members: Repository<Membership>,
    @InjectRepository(Invitation) private readonly invitations: Repository<Invitation>,
    @InjectRepository(MediaAsset) private readonly media: Repository<MediaAsset>,
    private readonly settings: SettingsService,
  ) {}

  /** Platform defaults (code defaults overlaid with the stored 'limits' setting). */
  async platformDefaults(): Promise<Required<OrgLimits>> {
    const stored = await this.settings.get<OrgLimits>('limits', {});
    return { ...DEFAULT_LIMITS, ...stored };
  }

  /** Effective limits of an organization: code default < platform setting < organization override. */
  async effective(orgId: string): Promise<Required<OrgLimits>> {
    const org = await this.orgs.findOne({ where: { id: orgId } });
    return { ...(await this.platformDefaults()), ...(org?.limits ?? {}) };
  }

  async usage(orgId: string): Promise<OrgUsage> {
    const [screens, devices, members, pending, mediaStats] = await Promise.all([
      this.screens.count({ where: { organizationId: orgId } }),
      this.devices.count({ where: { organizationId: orgId } }),
      this.members.count({ where: { organizationId: orgId } }),
      this.invitations
        .createQueryBuilder('i')
        .where('i.organization_id = :orgId AND i.accepted_at IS NULL AND i.expires_at > :now', {
          orgId,
          now: new Date(),
        })
        .getCount(),
      this.media
        .createQueryBuilder('m')
        .select('COUNT(*)', 'files')
        .addSelect('COALESCE(SUM(m.size_bytes), 0)', 'bytes')
        .where('m.organization_id = :orgId', { orgId })
        .getRawOne<{ files: string | number; bytes: string | number }>(),
    ]);
    return {
      screens,
      devices,
      members: members + pending,
      mediaFiles: Number(mediaStats?.files ?? 0),
      storageBytes: Number(mediaStats?.bytes ?? 0),
    };
  }

  /**
   * Called before a new record is added; a full limit yields 403 (code: LIMIT_REACHED).
   * The superadmin (platform owner) is exempt.
   */
  async assertCanAdd(viewer: AuthUser, orgId: string, resource: LimitResource): Promise<void> {
    if (viewer.role === 'superadmin') return;
    const [limits, usage] = await Promise.all([this.effective(orgId), this.usage(orgId)]);
    const max = {
      screens: limits.maxScreens,
      devices: limits.maxDevices,
      members: limits.maxMembers,
      media: limits.maxMediaFiles,
    }[resource];
    const used = resource === 'media' ? usage.mediaFiles : usage[resource];
    if (used >= max) {
      throw limitReached(
        `Plan limit reached: at most ${max} ${LABEL[resource]} allowed. Contact your administrator to raise the limit.`,
        resource,
        max,
      );
    }
  }

  /** Checks a media upload against file size, count, storage quota and video length limits. */
  async assertCanUpload(
    viewer: AuthUser,
    orgId: string,
    file: { sizeBytes: number; kind: 'image' | 'video'; durationSec?: number | null },
  ): Promise<void> {
    if (viewer.role === 'superadmin') return;
    const [limits, usage] = await Promise.all([this.effective(orgId), this.usage(orgId)]);
    if (file.sizeBytes > limits.maxUploadMb * MB) {
      throw limitReached(
        `File is too large: the limit is ${limits.maxUploadMb} MB per file.`,
        'upload',
        limits.maxUploadMb,
      );
    }
    if (usage.mediaFiles >= limits.maxMediaFiles) {
      throw limitReached(
        `Plan limit reached: at most ${limits.maxMediaFiles} media files allowed.`,
        'media',
        limits.maxMediaFiles,
      );
    }
    if (usage.storageBytes + file.sizeBytes > limits.storageQuotaMb * MB) {
      throw limitReached(
        `Storage quota exceeded: ${limits.storageQuotaMb} MB available in total.`,
        'storage',
        limits.storageQuotaMb,
      );
    }
    if (file.kind === 'video' && file.durationSec != null && file.durationSec > limits.maxVideoSeconds) {
      throw limitReached(
        `Video is too long: the limit is ${limits.maxVideoSeconds} seconds.`,
        'video-duration',
        limits.maxVideoSeconds,
      );
    }
  }
}
