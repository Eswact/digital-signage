import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/**
 * Yenileme jetonu (opak, DB'de SHA-256 özeti). Her yenilemede döner (rotation);
 * aynı "aile" (family) içinde iptal edilmiş jeton tekrar kullanılırsa çalınma
 * şüphesiyle tüm aile iptal edilir.
 */
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Index()
  @Column({ name: 'family_id' })
  familyId: string;

  /** Oturumun etkin organizasyonu (yenilemede korunur). */
  @Column({ name: 'organization_id', type: 'varchar', nullable: true })
  organizationId?: string | null;

  @Column({ name: 'user_agent', type: 'varchar', nullable: true })
  userAgent?: string | null;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'datetime', nullable: true })
  revokedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
