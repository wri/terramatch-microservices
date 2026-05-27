import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserContext } from "../contexts/user.context";

const OPTIONAL_BEARER_AUTH = "optionalBearerAuth";
export const AuthOptional = SetMetadata(OPTIONAL_BEARER_AUTH, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const optionalAuth = this.reflector.getAllAndOverride<boolean>(OPTIONAL_BEARER_AUTH, [
      context.getHandler(),
      context.getClass()
    ]);
    if (optionalAuth) return true;

    if (UserContext.authenticatedUserId == null) throw new UnauthorizedException();
    return true;
  }
}
