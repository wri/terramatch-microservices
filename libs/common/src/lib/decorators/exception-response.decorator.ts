import { applyDecorators, HttpException, Type } from "@nestjs/common";
import { ApiResponse, ApiResponseOptions } from "@nestjs/swagger";
import { Dictionary } from "lodash";
import { TranslatableException } from "../exceptions/translatable.exception";
import { ReferenceObject, SchemaObject } from "@nestjs/swagger/dist/interfaces/open-api-spec.interface";

type Exception<T extends HttpException> = Type<T>;

export function ExceptionResponse<T extends HttpException>(exception: Exception<T>, options: ApiResponseOptions) {
  const instance = new exception();
  const schema = {
    type: "object",
    required: ["statusCode", "message"],
    properties: {
      statusCode: { type: "number", example: instance.getStatus() },
      message: { type: "string", example: instance.message }
    } as Dictionary<SchemaObject | ReferenceObject>
  };

  if (instance instanceof TranslatableException) {
    schema.properties["code"] = {
      type: "string",
      description: "A code to lookup the error message translation string on the client."
    };
    schema.properties["variables"] = {
      type: "object",
      description: "A set of variables to pass to the translation service."
    };
  }

  return applyDecorators(
    ApiResponse({
      ...options,
      status: instance.getStatus(),
      schema
    })
  );
}
