import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Device } from '../devices/device.entity';

@Entity('groups')
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

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

  /** Gruba en son atanan ekran (panelde seçili göstermek için). */
  @Column({ name: 'current_screen_id', type: 'varchar', nullable: true })
  currentScreenId?: string | null;

  @OneToMany(() => Device, (device) => device.group)
  devices: Device[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
