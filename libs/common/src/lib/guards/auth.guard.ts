import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || token == null) throw new UnauthorizedException();

    try {
      const { sub } = await this.jwtService.verifyAsync(token);
      // Most requests won't need the actual user object; instead the roles and permissions
      // are fetched from other (smaller) tables, and only the user id is needed.
      request.authorizedUserId = sub;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
