import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '../users/user.entity';
import { OrgRole } from '../organizations/membership.entity';

/** İstek bağlamındaki kullanıcı: platform rolü + etkin organizasyon ve oradaki rolü. */
export interface AuthUser {
  id: string;
  email: string;
  /** Platform rolü (superadmin tüm organizasyonları görür). */
  role: UserRole;
  /** Etkin organizasyon (üyeliği olmayan kullanıcıda null). */
  orgId: string | null;
  orgRole: OrgRole | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
