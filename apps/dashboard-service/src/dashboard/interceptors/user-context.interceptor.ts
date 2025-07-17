import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { JwtService } from "@nestjs/jwt";

@Injectable()
export class UserContextInterceptor implements NestInterceptor {
  constructor(private jwtService: JwtService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (
      authHeader !== undefined &&
      authHeader !== null &&
      typeof authHeader === "string" &&
      authHeader.startsWith("Bearer ")
    ) {
      const token = authHeader.substring(7);

      try {
        const payload = this.jwtService.verify(token);
        if (payload.sub !== undefined && payload.sub !== null && typeof payload.sub === "number") {
          request.authenticatedUserId = payload.sub;
        }
      } catch {
        // Silently ignore invalid tokens - this endpoint allows unauthenticated access
      }
    }

    return next.handle();
  }
}
