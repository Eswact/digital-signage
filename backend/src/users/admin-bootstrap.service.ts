import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';

/**
 * Açılışta `.env`'deki ADMIN_EMAIL kullanıcısının admin olmasını garanti eder:
 * - Kullanıcı varsa ve admin değilse → admin yapılır.
 * - Kullanıcı yoksa → ADMIN_PASSWORD ile admin olarak oluşturulur.
 * Deterministik ve tekrar çalıştırılabilir (idempotent).
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const email = this.config.get<string>('ADMIN_EMAIL')?.trim().toLowerCase();
    if (!email) return;

    const existing = await this.users.findByEmail(email);
    if (existing) {
      if (existing.role !== 'superadmin') {
        await this.users.updateProfile(existing.id, { role: 'superadmin' });
        this.logger.log(`Bootstrap: ${email} promoted to superadmin`);
      }
      return;
    }

    const password = this.config.get<string>('ADMIN_PASSWORD');
    if (!password && this.config.get<string>('NODE_ENV') === 'production') {
      // Production'da yönetici hesabı olmadan açılıp ilk gelenin "kayıt ol"
      // ile superadmin olmasına izin verme.
      throw new Error(`Bootstrap: ${email} does not exist and ADMIN_PASSWORD is not set`);
    }
    if (!password) {
      this.logger.warn(
        `Bootstrap: ${email} not found and ADMIN_PASSWORD is not set — skipping`,
      );
      return;
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await this.users.create({ email, passwordHash, role: 'superadmin' });
    this.logger.log(`Bootstrap: superadmin user created (${email})`);
  }
}
