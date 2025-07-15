import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { NoBearerAuth } from "@terramatch-microservices/common/guards";

@Injectable()
export class DashboardAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const noBearerAuth = this.reflector.get<boolean>(NoBearerAuth, context.getHandler());

    if (noBearerAuth) {
      return true;
    }

    return true;
  }
}
