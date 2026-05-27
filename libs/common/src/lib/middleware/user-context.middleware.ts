import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";
import { UserContext } from "../contexts/user.context";
import { Permission, User } from "@terramatch-microservices/database/entities";

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}

  async use(req: Request, _: unknown, next: NextFunction) {
    const [type, token] = req.headers.authorization?.split(" ") ?? [];
    if (type !== "Bearer" || token == null) {
      next();
      return;
    }

    const userId = this.isJwtToken(token) ? await this.getJwtUserId(token) : await this.getApiKeyUserId(token);
    if (userId == null) {
      next();
      return;
    }

    const permissions = await Permission.getUserPermissionNames(userId);
    const locale = await User.findLocale(userId);
    UserContext.use(userId, permissions, locale ?? "en-US", next);
  }

  private isJwtToken(token: string) {
    return this.jwtService.decode(token) != null;
  }

  private async getJwtUserId(token: string): Promise<number | null> {
    try {
      const { sub } = await this.jwtService.verifyAsync(token);
      return sub;
    } catch {
      return null;
    }
  }

  private async getApiKeyUserId(token: string): Promise<number | null> {
    try {
      const { sub } = await this.jwtService.verifyAsync(token);
      return sub;
    } catch {
      return null;
    }
  }
}
