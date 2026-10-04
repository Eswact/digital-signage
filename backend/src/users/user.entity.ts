import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type UserRole = 'superadmin' | 'user';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ nullable: true })
  name?: string;

  /** superadmin: tüm hesapları/cihazları görür+yönetir. user: yalnızca kendi hesabı. */
  @Column({ type: 'varchar', default: 'user' })
  role: UserRole;

  /**
   * Oturum sürümü: artırılınca (parola değişimi/sıfırlama, "tüm oturumlardan
   * çık") bu kullanıcının daha önce verilmiş TÜM erişim jetonları geçersiz olur.
   */
  @Column({ name: 'token_version', type: 'integer', default: 0 })
  tokenVersion: number;

  /** TOTP gizli anahtarı (AES-256-GCM ile şifreli). 2FA kurulum/etkinleştirme akışında dolar. */
  @Column({ name: 'totp_secret_enc', type: 'varchar', nullable: true })
  totpSecretEnc?: string | null;

  @Column({ name: 'totp_enabled', type: 'boolean', default: false })
  totpEnabled: boolean;

  /** Kullanılmamış kurtarma kodlarının SHA-256 özetleri (tek kullanımlık). */
  @Column({ name: 'recovery_codes', type: 'simple-json', nullable: true })
  recoveryCodes?: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
