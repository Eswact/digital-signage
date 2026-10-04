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

export type ScheduleTarget = 'device' | 'group';

/**
 * "Show screen X on device/group Y during these hours." While a schedule is
 * active it overrides the target's base assignment (`Device.currentScreenId`);
 * when none is active the base screen is shown again.
 */
@Entity('schedules')
export class Schedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: Organization;

  @Index()
  @Column({ name: 'organization_id', type: 'varchar' })
  organizationId: string;

  @Column()
  name: string;

  @Column({ name: 'target_type', type: 'varchar' })
  targetType: ScheduleTarget;

  /** Device.id or Group.id depending on `targetType`. */
  @Column({ name: 'target_id', type: 'varchar' })
  targetId: string;

  @ManyToOne(() => Screen, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'screen_id' })
  screen?: Screen;

  @Column({ name: 'screen_id', type: 'varchar' })
  screenId: string;

  /** Days of the week the schedule applies to (0 = Sunday … 6 = Saturday), in the organization's time zone. */
  @Column({ type: 'simple-json' })
  days: number[];

  /** "HH:mm" local start; null together with `endTime` = all day. */
  @Column({ name: 'start_time', type: 'varchar', nullable: true })
  startTime?: string | null;

  /** "HH:mm" local end (exclusive). Earlier than `startTime` = runs past midnight. */
  @Column({ name: 'end_time', type: 'varchar', nullable: true })
  endTime?: string | null;

  /** Higher wins when several schedules overlap. */
  @Column({ type: 'integer', default: 0 })
  priority: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
