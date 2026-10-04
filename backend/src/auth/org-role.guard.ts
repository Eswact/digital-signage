import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuthUser } from './current-user.decorator';
import { ORG_ROLE_RANK, OrgRole } from '../organizations/membership.entity';

const MIN_ROLE_KEY = 'minOrgRole';

/** Uç için en düşük organizasyon rolü. Varsayılan: okuma → viewer, yazma → editor. */
export const MinOrgRole = (role: OrgRole) => SetMetadata(MIN_ROLE_KEY, role);

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * JwtAuthGuard'dan SONRA çalışır. Organizasyon rolünü zorlar:
 * okuma (GET) için üyelik yeterli, yazma için editor; @MinOrgRole ile değiştirilir.
 * Superadmin her şeyi yapabilir.
 */
@Injectable()
export class OrgRoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const user = ctx.switchToHttp().getRequest().user as AuthUser | undefined;
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    if (!user.orgRole) throw new ForbiddenException('You are not a member of any organization');

    const explicit = this.reflector.getAllAndOverride<OrgRole | undefined>(MIN_ROLE_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const method = ctx.switchToHttp().getRequest().method as string;
    const required: OrgRole = explicit ?? (READ_METHODS.has(method) ? 'viewer' : 'editor');
    if (ORG_ROLE_RANK[user.orgRole] < ORG_ROLE_RANK[required]) {
      throw new ForbiddenException('Your role does not allow this action');
    }
    return true;
  }
}

/** Kimlik + organizasyon rolü: organizasyona ait kaynak uçları için. */
export const OrgAuth = () => applyDecorators(UseGuards(JwtAuthGuard, OrgRoleGuard));
