import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { User } from "@terramatch-microservices/database/entities";
import { JwtService } from "@nestjs/jwt";

export const CurrentUser = createParamDecorator(async (data: unknown, ctx: ExecutionContext): Promise<User | null> => {
  const request = ctx.switchToHttp().getRequest();
  const authHeader = request.headers.authorization;
  if (
    authHeader === null ||
    authHeader === undefined ||
    typeof authHeader !== "string" ||
    !authHeader.startsWith("Bearer ")
  ) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const jwtService = new JwtService({ secret: process.env.JWT_SECRET });
    const payload = await jwtService.verifyAsync(token);

    if (payload.sub === null || payload.sub === undefined || typeof payload.sub !== "number") {
      return null;
    }

    return await User.findOne({
      where: { id: payload.sub },
      attributes: ["id", "emailAddress", "firstName", "lastName", "organisationId"]
    });
  } catch (error) {
    return error;
  }
});
