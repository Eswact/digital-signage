import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../users/user.entity';

export const ROLES_KEY = 'roles';

/** Uç noktayı belirli rollerle sınırlar. RolesGuard ile birlikte kullanılır. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
