import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Device } from '../devices/device.entity';

/**
 * Desteklenen şablonlar. Android TemplateRegistry ile aynı isimler kullanılır.
 * Eski `announcement` şablonu `info-board`'a birleştirildi (bkz. ScreenMigrationsService).
 */
export type TemplateType =
  | 'order-board'
  | 'queue-number'
  | 'info-board'
  | 'media-player'
  | 'webview';

/**
 * Ekranın gösterileceği yön. Cihaz bu değere göre döner.
 * `auto` (uyumlu): yön kilitlenmez, cihazın o anki durumuna göre değişir.
 */
export type OrientationType = 'landscape' | 'portrait' | 'auto';

@Entity('screens')
export class Screen {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', default: 'info-board' })
  template: TemplateType;

  @Column({ type: 'varchar', default: 'landscape' })
  orientation: OrientationType;

  /** Şablona özgü veri (title, body vs.). Şema template'e göre değişir. */
  @Column({ type: 'simple-json', default: '{}' })
  data: Record<string, unknown>;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  /** Sahip organizasyon. Sütun yalnızca eski kayıtlar taşınana dek boş olabilir. */
  @Column({ name: 'organization_id', type: 'varchar', nullable: true })
  organizationId: string;

  /**
   * ESKİ sahiplik (kullanıcı). Yalnızca açılıştaki veri taşıma
   * (OrganizationBackfillService) için okunur; yeni kod organizationId kullanır.
   * Taşıma güvenle bittiğinde ayrı bir migration ile kaldırılacak.
   */
  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  legacyUserId?: string | null;

  @OneToMany(() => Device, (device) => device.currentScreen)
  devices: Device[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
