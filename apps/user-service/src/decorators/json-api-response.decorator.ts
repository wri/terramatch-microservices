/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiExtraModels, ApiResponse, ApiResponseOptions, getSchemaPath } from '@nestjs/swagger';
import { HttpStatus } from '@nestjs/common';
import { JsonApiDataDto } from '../interfaces/json-api-data-dto.interface';

/**
 * Decorator to simplify wrapping the response type from a controller method with the JSON API
 * response structure. Applies the ApiExtraModels and ApiResponse decorators.
 */
export function JsonApiResponse<C extends JsonApiDataDto>(
  options: ApiResponseOptions & { dataType: new () => C }
): MethodDecorator & ClassDecorator {
  const { dataType, status, ...rest } = options;
  const apiResponseOptions = {
    ...rest,
    status: status ?? HttpStatus.OK,
    schema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          $ref: getSchemaPath(dataType)
        }
      }
    }
  } as ApiResponseOptions

  return (
    target: object,
    key?: string | symbol,
    descriptor?: TypedPropertyDescriptor<any>
  ): any => {
    return ApiResponse(apiResponseOptions)(ApiExtraModels(dataType)(target, key, descriptor), key, descriptor);
  }
}
