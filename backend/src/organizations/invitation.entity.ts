import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Organization } from './organization.entity';
import { OrgRole } from './membership.entity';

/** E-posta ile davet. Ham jeton yalnızca davet bağlantısında; DB'de SHA-256 özeti. */
@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'varchar' })
  organizationId: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', default: 'viewer' })
  role: OrgRole;

  @Index({ unique: true })
  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Column({ name: 'invited_by_id', type: 'varchar', nullable: true })
  invitedById?: string | null;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'accepted_at', type: 'datetime', nullable: true })
  acceptedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
