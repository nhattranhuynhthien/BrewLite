import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/authenticated-request';

// Deployment-owned allowlist; registration/profile updates cannot grant this permission.
@Injectable()
export class OrderOperatorGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const ids = (process.env.ORDER_OPERATOR_USER_IDS ?? '').split(',').map(id => id.trim());
    if (!request.user || !ids.includes(String(request.user.sub))) {
      throw new ForbiddenException('Tài khoản không có quyền vận hành đơn hàng.');
    }
    return true;
  }
}
