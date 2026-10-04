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

export type MediaKind = 'image' | 'video';
/** Where the file was added from; every asset lives in the same library regardless. */
export type MediaOrigin = 'library' | 'screen' | 'overlay';

/**
 * An uploaded image or video. All uploads of an organization form one library
 * ("Uploads"); screens reference assets by id (see MediaService.normalizeRefs).
 */
@Entity('media_assets')
@Index(['organizationId', 'sha256'])
export class MediaAsset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @Column({ name: 'organization_id', type: 'varchar' })
  organizationId: string;

  @Column({ name: 'uploaded_by_id', type: 'varchar', nullable: true })
  uploadedById?: string | null;

  @Column({ type: 'varchar' })
  kind: MediaKind;

  /** Display name (editable); starts as the original file name. */
  @Column()
  name: string;

  @Column({ name: 'original_name' })
  originalName: string;

  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  @Column({ type: 'integer', nullable: true })
  width?: number | null;

  @Column({ type: 'integer', nullable: true })
  height?: number | null;

  @Column({ name: 'duration_ms', type: 'integer', nullable: true })
  durationMs?: number | null;

  /** SHA-256 of the file; devices verify downloads against it. */
  @Column()
  sha256: string;

  /** Average color (#rrggbb), computed by the panel for images; used for letterbox fill. */
  @Column({ name: 'avg_color', type: 'varchar', nullable: true })
  avgColor?: string | null;

  @Column({ type: 'varchar', default: 'library' })
  origin: MediaOrigin;

  @Column({ name: 'storage_key' })
  storageKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
