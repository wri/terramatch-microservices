import { applyDecorators, HttpException, Type } from "@nestjs/common";
import { ApiResponse, ApiResponseOptions } from "@nestjs/swagger";

type Exception<T extends HttpException> = Type<T>;

export function ExceptionResponse<T extends HttpException>(exception: Exception<T>, options: ApiResponseOptions) {
  const instance = new exception();
  return applyDecorators(
    ApiResponse({
      ...options,
      status: instance.getStatus(),
      schema: {
        type: "object",
        properties: {
          statusCode: { type: "number", example: instance.getStatus() },
          message: { type: "string", example: instance.message }
        }
      }
    })
  );
}
