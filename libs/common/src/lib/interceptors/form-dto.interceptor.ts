import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor
} from "@nestjs/common";

@Injectable()
export class FormDtoInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.body == null) {
      throw new InternalServerErrorException("FormDtoInterceptor is only valid with a request that contains a body");
    }
    const { dto } = request.body as unknown as { dto: string };
    if (dto == null) {
      throw new BadRequestException("The FormData is required to have a 'dto' value assigned");
    }

    try {
      // @ts-expect-error request.body is meant to be read only, but in this case we're stomping on it.
      request.body = JSON.parse(dto);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }

    return next.handle();
  }
}
