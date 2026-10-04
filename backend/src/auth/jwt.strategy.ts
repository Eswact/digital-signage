import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuthUser } from './current-user.decorator';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** İsteğin etkin organizasyonu (üyelik her istekte DB'den doğrulanır). */
  org: string | null;
  /** Kullanıcının oturum sürümü; artırılınca eski jetonlar geçersiz olur. */
  tv: number;
  /** Yalnızca 2FA meydan okuma jetonunda; erişim jetonu olarak KABUL EDİLMEZ. */
  purpose?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
    private readonly orgs: OrganizationsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (payload.purpose) throw new UnauthorizedException();
    const user = await this.users.findById(payload.sub);
    if (!user || user.tokenVersion !== payload.tv) throw new UnauthorizedException();

    // Rol ve üyelik her istekte DB'den: rol değişikliği/çıkarılma anında geçerli olur.
    const memberships = await this.orgs.membershipsOf(user.id);
    const active = memberships.find((m) => m.organizationId === payload.org) ?? memberships[0];
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      orgId: active?.organizationId ?? null,
      orgRole: active?.role ?? null,
    };
  }
}
