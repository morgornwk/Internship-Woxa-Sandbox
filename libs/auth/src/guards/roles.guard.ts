import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@common/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthUser } from '../types/auth-user.type';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      method?: string;
    }>();

    if (request.method === 'OPTIONS') {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Missing authentication');
    }

    // OWNER มีสิทธิ์เทียบเท่า ADMIN ทุกอย่าง — ผ่าน guard ทุกกรณี
    if (user.role === UserRole.OWNER) {
      return true;
    }

    const hasPermission = requiredRoles.some((role) => user.role === role);

    if (!hasPermission) {
      throw new UnauthorizedException('Insufficient role');
    }

    return true;
  }
}
