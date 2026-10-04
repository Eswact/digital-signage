import { ForbiddenException } from '@nestjs/common';
import { AuthUser } from '../auth/current-user.decorator';

/**
 * Kiracı izolasyonu: superadmin filtresiz; diğerleri yalnızca etkin
 * organizasyonunun kayıtlarını görür. `where` koşuluna yayılır.
 */
export function orgScope(viewer: AuthUser): { organizationId?: string } {
  if (viewer.role === 'superadmin') return {};
  if (!viewer.orgId) throw new ForbiddenException('You are not a member of any organization');
  return { organizationId: viewer.orgId };
}

/** Kayıt bu kullanıcının kapsamında mı? */
export function inScope(viewer: AuthUser, recordOrgId?: string | null): boolean {
  return viewer.role === 'superadmin' || (!!viewer.orgId && recordOrgId === viewer.orgId);
}

/** Yeni kayıt için sahip organizasyon (yoksa 403). */
export function ownerOrgId(viewer: AuthUser): string {
  if (!viewer.orgId) throw new ForbiddenException('You are not a member of any organization');
  return viewer.orgId;
}
