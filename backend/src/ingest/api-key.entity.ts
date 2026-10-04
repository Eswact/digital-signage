import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from '../organizations/organization.entity';
import { Screen } from '../screens/screen.entity';

/**
 * Dış sistemlerin (POS vb.) veri göndermesi için ekran-kapsamlı API anahtarı.
 * Bir anahtar tek bir ekrana bağlıdır → o pano için veri akışı.
 * Anahtarın kendisi saklanmaz: yalnızca SHA-256 özeti ve tanınması için ön eki.
 * Ham anahtar yalnızca oluşturulduğu an bir kez döner.
 */
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Eski sürümlerden kalan düz metin anahtar. Açılışta hash'e taşınıp
   * null yapılır (ApiKeysService.onApplicationBootstrap); yeni kayıtta boş.
   */
  @Column({ name: 'key', type: 'varchar', nullable: true, select: false })
  legacyKey?: string | null;

  @Index({ unique: true })
  @Column({ name: 'key_hash', type: 'varchar', nullable: true, select: false })
  keyHash?: string | null;

  /** Panelde gösterilen ilk karakterler (ör. "sk_1a2b3c4d"). */
  @Column({ type: 'varchar', default: '' })
  prefix: string;

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

  @ManyToOne(() => Screen, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screen_id' })
  screen: Screen;

  @Column({ name: 'screen_id', type: 'varchar' })
  screenId: string;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
