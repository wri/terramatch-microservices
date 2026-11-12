import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, NextFunction } from "express";
import { JwtService } from "@nestjs/jwt";
import { UserContext } from "../contexts/user.context";
import { ApiKey, User } from "@terramatch-microservices/database/entities";
import { Attributes } from "sequelize";

const USER_CONTEXT_ATTRIBUTES: (keyof Attributes<User>)[] = ["id", "roles", "locale"];

@Injectable()
export class UserContextMiddleware implements NestMiddleware {
  constructor(private jwtService: JwtService) {}

  async use(req: Request, _: unknown, next: NextFunction) {
    const [type, token] = req.headers.authorization?.split(" ") ?? [];
    if (type !== "Bearer" || token == null) {
      next();
      return;
    }

    const user = this.isJwtToken(token)
      ? await this.findJwtUser(token)
      : await ApiKey.findUser(token, USER_CONTEXT_ATTRIBUTES);
    if (user == null) {
      next();
      return;
    }

    UserContext.use(user.id, user.permissions, user.locale, next);
  }

  private isJwtToken(token: string) {
    return this.jwtService.decode(token) != null;
  }

  private async findJwtUser(token: string) {
    const userId = await this.getJwtUserId(token);
    return userId == null ? null : await User.findOne({ where: { id: userId }, attributes: USER_CONTEXT_ATTRIBUTES });
  }

  private async getJwtUserId(token: string) {
    try {
      const { sub } = await this.jwtService.verifyAsync(token);
      return (sub ?? null) as number | null;
    } catch {
      return null;
    }
  }
}
