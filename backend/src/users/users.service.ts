import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User, UserRole } from './user.entity';
import { RefreshToken } from '../auth/refresh-token.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  /** E-posta büyük/küçük harfe duyarsız aranır. */
  findByEmail(email: string): Promise<User | null> {
    return this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = LOWER(:email)', { email: email.trim() })
      .getOne();
  }

  findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    name?: string;
    role?: UserRole;
  }): Promise<User> {
    const user = this.repo.create({ ...data, email: data.email.trim().toLowerCase() });
    return this.repo.save(user);
  }

  /** Tüm kullanıcılar (parola hash'i hariç sunulur — controller seçer). */
  list(): Promise<User[]> {
    return this.repo.find({ order: { createdAt: 'ASC' } });
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  countSuperadmins(): Promise<number> {
    return this.repo.count({ where: { role: 'superadmin' } });
  }

  async updateProfile(
    id: string,
    data: { name?: string; role?: UserRole; passwordHash?: string },
  ): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) return null;
    if (data.name !== undefined) user.name = data.name;
    if (data.role !== undefined) user.role = data.role;
    if (data.passwordHash !== undefined) user.passwordHash = data.passwordHash;
    return this.repo.save(user);
  }

  /** Tüm eski erişim jetonlarını geçersiz kılar. */
  async bumpTokenVersion(id: string): Promise<void> {
    await this.repo.increment({ id }, 'tokenVersion', 1);
  }

  /** Ends every session of the user: refresh tokens revoked, issued access tokens invalidated. */
  async revokeSessions(id: string): Promise<void> {
    await this.bumpTokenVersion(id);
    await this.repo.manager.update(RefreshToken, { userId: id, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  setTwoFactor(
    id: string,
    data: { totpSecretEnc?: string | null; totpEnabled?: boolean; recoveryCodes?: string[] | null },
  ) {
    return this.repo.update({ id }, data);
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
