import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Plan limitleri. Alan yoksa platform varsayılanı (settings 'limits') geçerlidir. */
export interface OrgLimits {
  maxScreens?: number;
  maxDevices?: number;
  maxMembers?: number;
  /** Media storage quota in MB (enforced on upload). */
  storageQuotaMb?: number;
  /** Maximum number of media files (images + videos). */
  maxMediaFiles?: number;
  /** Maximum length of an uploaded video, in seconds. */
  maxVideoSeconds?: number;
  /** Maximum size of a single uploaded file, in MB. */
  maxUploadMb?: number;
}

/**
 * Çok kiracılı birim: cihaz, ekran, grup ve API anahtarları kullanıcıya değil
 * organizasyona aittir; kullanıcılar üyelik (Membership) ile bağlanır.
 */
@Entity('organizations')
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  /** Serbest etiket (ör. "standard", "pro"); limitler `limits` ile belirlenir. */
  @Column({ type: 'varchar', default: 'standard' })
  plan: string;

  /** IANA time zone used to evaluate schedules (e.g. "Europe/Istanbul"). */
  @Column({ type: 'varchar', default: 'UTC' })
  timezone: string;

  /** Bu organizasyona özel limit istisnaları. */
  @Column({ type: 'simple-json', nullable: true })
  limits?: OrgLimits | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
