import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Group } from '../groups/group.entity';
import { Screen } from '../screens/screen.entity';

export type DeviceStatus = 'online' | 'offline';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Android'in ürettiği, ekranda gösterilen benzersiz kod (pairing için). */
  @Index({ unique: true })
  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ nullable: true })
  name?: string;

  /**
   * Cihaza özel gizli anahtarın SHA-256 özeti. İlk kayıtta üretilir, ham hali
   * yalnızca cihaza bir kez döner; WS el sıkışmasında doğrulanır.
   */
  @Column({ name: 'secret_hash', type: 'varchar', nullable: true, select: false })
  secretHash?: string | null;

  /** Cihazın bildirdiği APK sürümü (versionCode / versionName). */
  @Column({ name: 'app_version', type: 'integer', nullable: true })
  appVersion?: number | null;

  @Column({ name: 'app_version_name', type: 'varchar', nullable: true })
  appVersionName?: string | null;

  /** Cihazın desteklediği şablonlar ve şema sürümleri ({ "order-board": 1 }). */
  @Column({ type: 'simple-json', nullable: true })
  templates?: Record<string, number> | null;

  @Column({ type: 'varchar', default: 'offline' })
  status: DeviceStatus;

  @Column({ name: 'last_seen_at', type: 'datetime', nullable: true })
  lastSeenAt?: Date | null;

  @Column({ name: 'paired_at', type: 'datetime', nullable: true })
  pairedAt?: Date | null;

  // Eşleştirilene kadar organizasyon null olur (sahipsiz cihaz).
  @ManyToOne(() => Organization, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization | null;

  @Column({ name: 'organization_id', type: 'varchar', nullable: true })
  organizationId?: string | null;

  /**
   * ESKİ sahiplik (kullanıcı). Yalnızca açılıştaki veri taşıma
   * (OrganizationBackfillService) için okunur; yeni kod organizationId kullanır.
   * Taşıma güvenle bittiğinde ayrı bir migration ile kaldırılacak.
   */
  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  legacyUserId?: string | null;

  @ManyToOne(() => Group, (group) => group.devices, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'group_id' })
  group?: Group | null;

  @Column({ name: 'group_id', type: 'varchar', nullable: true })
  groupId?: string | null;

  // Base assignment: the screen the device shows when no schedule is active.
  @ManyToOne(() => Screen, (screen) => screen.devices, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'current_screen_id' })
  currentScreen?: Screen | null;

  @Column({ name: 'current_screen_id', type: 'varchar', nullable: true })
  currentScreenId?: string | null;

  /**
   * The screen the device shows right now: an active schedule's screen, else
   * `currentScreenId`. Maintained by ScheduleEngine; patches go to devices by this.
   */
  @ManyToOne(() => Screen, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'active_screen_id' })
  activeScreen?: Screen | null;

  @Column({ name: 'active_screen_id', type: 'varchar', nullable: true })
  activeScreenId?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
