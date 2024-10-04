import {
  CanActivate,
  ExecutionContext,
  Injectable, SetMetadata,
  UnauthorizedException
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';

const NO_BEARER_AUTH = 'noBearerAuth';
export const NoBearerAuth = SetMetadata(NO_BEARER_AUTH, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipAuth = this.reflector.getAllAndOverride<boolean>(NO_BEARER_AUTH, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAuth) return true;

    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || token == null) throw new UnauthorizedException();

    try {
      const { sub } = await this.jwtService.verifyAsync(token);
      // Most requests won't need the actual user object; instead the roles and permissions
      // are fetched from other (smaller) tables, and only the user id is needed.
      request.authenticatedUserId = sub;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
