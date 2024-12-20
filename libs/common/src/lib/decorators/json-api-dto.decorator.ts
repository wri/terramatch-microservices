import { applyDecorators, SetMetadata } from "@nestjs/common";

export const DTO_TYPE_METADATA = "DTO_TYPE_METADATA";
export const DTO_ID_METADATA = "DTO_ID_METADATA";

export type IdType = "uuid" | "number" | "string";

export type DtoOptions = {
  type: string;

  /**
   * The type of the id for this DTO. Defaults to UUID
   */
  id?: IdType;
};

export const JsonApiDto = (options: DtoOptions) =>
  applyDecorators(SetMetadata(DTO_TYPE_METADATA, options.type), SetMetadata(DTO_ID_METADATA, options.id ?? "uuid"));
