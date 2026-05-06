import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { Permission, User } from "@terramatch-microservices/database/entities";
import { RequestContext } from "nestjs-request-context";
import { PolicyBuilder } from "../policies/policy.service";
import { ValidLocale } from "@terramatch-microservices/database/constants/locale";

const NO_BEARER_AUTH = "noBearerAuth";
export const NoBearerAuth = SetMetadata(NO_BEARER_AUTH, true);

const OPTIONAL_BEARER_AUTH = "optionalBearerAuth";
export const OptionalBearerAuth = SetMetadata(OPTIONAL_BEARER_AUTH, true);

export const authenticatedUserId = () => RequestContext.currentContext?.req?.authenticatedUserId as number | undefined;
export const permissions = () => RequestContext.currentContext?.req?.permissions as string[] | undefined;
export const policyBuilder = () => RequestContext.currentContext?.req?.policyBuilder as PolicyBuilder | undefined;
export const userLocale = () => RequestContext.currentContext?.req?.userLocale as ValidLocale | undefined;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipAuth = this.reflector.getAllAndOverride<boolean>(NO_BEARER_AUTH, [
      context.getHandler(),
      context.getClass()
    ]);
    if (skipAuth) return true;

    const optionalAuth = this.reflector.getAllAndOverride<boolean>(OPTIONAL_BEARER_AUTH, [
      context.getHandler(),
      context.getClass()
    ]);

    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    if (type !== "Bearer" || token == null) {
      if (optionalAuth) return true;
      throw new UnauthorizedException();
    }

    const userId = this.isJwtToken(token) ? await this.getJwtUserId(token) : await this.getApiKeyUserId(token);
    if (userId == null) {
      if (optionalAuth) return true;
      throw new UnauthorizedException();
    }

    // Most requests won't need the actual user object; Instead, we cache the user id and a couple
    // of other frequently needed values on the request object.
    request.authenticatedUserId = userId;
    request.permissions = await Permission.getUserPermissionNames(userId);
    request.policyBuilder = new PolicyBuilder(userId, request.permissions);
    request.userLocale = await User.findLocale(userId);
    return true;
  }

  private isJwtToken(token: string) {
    return this.jwtService.decode(token) != null;
  }

  private async getJwtUserId(token: string) {
    try {
      const { sub } = await this.jwtService.verifyAsync(token);
      return sub;
    } catch {
      return null;
    }
  }

  private async getApiKeyUserId(token: string) {
    const { id } = (await User.findOne({ where: { apiKey: token }, attributes: ["id"] })) ?? {};
    return id;
  }
}
