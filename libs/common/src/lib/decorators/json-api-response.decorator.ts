/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiExtraModels, ApiResponse, ApiResponseOptions, getSchemaPath } from '@nestjs/swagger';
import { applyDecorators, HttpStatus } from '@nestjs/common';
import { DTO_ID_METADATA, DTO_TYPE_METADATA, IdType } from './json-api-dto.decorator';

type TypeProperties = {
  type: 'string';
  example: string;
}

type IdProperties = {
  type: 'string';
  format?: string;
  pattern?: string;
}

function constructProperties<DTO>(dataType: new (props: DTO) => DTO ) {
  const type: TypeProperties = { type: 'string', example: Reflect.getMetadata(DTO_TYPE_METADATA, dataType) };
  const id: IdProperties = { type: 'string' };
  const idFormat = Reflect.getMetadata(DTO_ID_METADATA, dataType) as IdType;
  switch (idFormat) {
    case 'uuid':
      id.format = 'uuid';
      break;

    case 'number':
      id.pattern = '^\\d{5}$';
      break;
  }

  return {
    type,
    id,
    attributes: {
      type: "object",
      $ref: getSchemaPath(dataType)
    }
  };
}

/**
 * Decorator to simplify wrapping the response type from a controller method with the JSON API
 * response structure. Applies the ApiExtraModels and ApiResponse decorators.
 */
export function JsonApiResponse<TData>(
  options: ApiResponseOptions & { data: new (props: TData) => TData }
) {
  const { data, status, ...rest } = options;

  const apiResponseOptions = {
    ...rest,
    status: status ?? HttpStatus.OK,
    schema: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: constructProperties(data),
        }
      }
    }
  } as ApiResponseOptions

  return applyDecorators(
    ApiResponse(apiResponseOptions),
    ApiExtraModels(data)
  );
  //
  // return (
  //   target: object,
  //   key: string | symbol,
  //   descriptor: TypedPropertyDescriptor<any>
  // ): any => {
  //   return ApiResponse(apiResponseOptions)(ApiExtraModels(dataType)(target, key, descriptor), key, descriptor);
  // }
}
