import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Platform ayarları (anahtar → JSON). Süper yönetici değiştirir (ör. 'limits'). */
@Entity('settings')
export class Setting {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'simple-json' })
  value: unknown;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
