import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): number | null => {
  const request = ctx.switchToHttp().getRequest();
  return request.authenticatedUserId !== undefined && request.authenticatedUserId !== null
    ? request.authenticatedUserId
    : null;
});
