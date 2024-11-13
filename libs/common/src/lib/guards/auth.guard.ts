import { CanActivate, ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { User } from "@terramatch-microservices/database/entities";

const NO_BEARER_AUTH = "noBearerAuth";
export const NoBearerAuth = SetMetadata(NO_BEARER_AUTH, true);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService, private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipAuth = this.reflector.getAllAndOverride<boolean>(NO_BEARER_AUTH, [
      context.getHandler(),
      context.getClass()
    ]);
    if (skipAuth) return true;

    const request = context.switchToHttp().getRequest();
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    if (type !== "Bearer" || token == null) throw new UnauthorizedException();

    const userId = this.isJwtToken(token) ? await this.getJwtUserId(token) : await this.getApiKeyUserId(token);
    if (userId == null) throw new UnauthorizedException();

    // Most requests won't need the actual user object; instead the roles and permissions
    // are fetched from other (smaller) tables, and only the user id is needed.
    request.authenticatedUserId = userId;
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
