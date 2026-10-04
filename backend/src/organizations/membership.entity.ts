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
import { User } from '../users/user.entity';

/** viewer: salt okunur · editor: içerik/cihaz yönetir · owner: üye ve ayar yönetir. */
export type OrgRole = 'owner' | 'editor' | 'viewer';
export const ORG_ROLES: OrgRole[] = ['owner', 'editor', 'viewer'];
export const ORG_ROLE_RANK: Record<OrgRole, number> = { viewer: 1, editor: 2, owner: 3 };

@Entity('memberships')
@Index(['organizationId', 'userId'], { unique: true })
export class Membership {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column({ name: 'organization_id', type: 'varchar' })
  organizationId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar', default: 'viewer' })
  role: OrgRole;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
