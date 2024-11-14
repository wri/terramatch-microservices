/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiExtraModels, ApiResponse, ApiResponseOptions, getSchemaPath } from "@nestjs/swagger";
import { applyDecorators, HttpStatus } from "@nestjs/common";
import { DTO_ID_METADATA, DTO_TYPE_METADATA, IdType } from "./json-api-dto.decorator";
import { JsonApiAttributes } from "../dto/json-api-attributes";

type TypeProperties = {
  type: "string";
  example: string;
};

type IdProperties = {
  type: "string";
  format?: string;
  pattern?: string;
};

type ResourceDef = {
  type: TypeProperties;
  id: IdProperties;
  attributes: object;
  relationships?: {
    type: "object";
    properties: {
      [key: string]: object;
    };
  };
  meta?: any;
};

function getIdProperties(resourceType: ResourceType): IdProperties {
  const id: IdProperties = { type: "string" };
  const idFormat = Reflect.getMetadata(DTO_ID_METADATA, resourceType) as IdType;
  switch (idFormat) {
    case "uuid":
      id.format = "uuid";
      break;

    case "number":
      id.pattern = "^\\d{5}$";
      break;
  }

  return id;
}

const getTypeProperties = (resourceType: ResourceType): TypeProperties => ({
  type: "string",
  example: Reflect.getMetadata(DTO_TYPE_METADATA, resourceType)
});

type ConstructResourceOptions = {
  pagination?: boolean;
};

function constructResource(resource: Resource, options?: ConstructResourceOptions) {
  const def: ResourceDef = {
    type: getTypeProperties(resource.type),
    id: getIdProperties(resource.type),
    attributes: {
      type: "object",
      $ref: getSchemaPath(resource.type)
    }
  };

  if (resource.relationships != null && resource.relationships.length > 0) {
    def.relationships = { type: "object", properties: {} };
    for (const { name, type, multiple, meta } of resource.relationships) {
      const relationship = {
        type: "object",
        properties: {
          type: getTypeProperties(type),
          id: getIdProperties(type)
        } as { [key: string]: any }
      };

      if (meta != null) {
        relationship.properties["meta"] = { type: "object", properties: meta };
      }

      if (multiple === true) {
        def.relationships.properties[name] = { type: "array", items: relationship };
      } else {
        def.relationships.properties[name] = relationship;
      }
    }
  }

  if (options?.pagination) {
    addMeta(def, "page", {
      type: "object",
      properties: {
        cursor: { type: "string", description: "The cursor for this record." }
      }
    });
  }

  return def;
}

function addMeta(def: Document | ResourceDef, name: string, definition: any) {
  if (def.meta == null) def.meta = { type: "object", properties: {} };
  def.meta.properties[name] = definition;
}

type ResourceType = new (...props: any[]) => JsonApiAttributes<any>;

type Relationship = {
  name: string;
  type: ResourceType;

  /**
   * If true, will represent that this relationship object is an array with potentially multiple
   * entries.
   */
  multiple?: boolean;

  /**
   * If supplied, will fold into the relationship docs. Should be a well-formed OpenAPI definition.
   */
  meta?: {
    [key: string]: { [key: string]: any };
  };
};

type Resource = {
  /**
   * The DTO for the attributes of the resource type
   */
  type: ResourceType;

  relationships?: Relationship[];
};

type JsonApiResponseProps = {
  data: Resource;

  /**
   * Set to true if this endpoint returns more than one resource in the main `data` member.
   * @default false
   */
  hasMany?: boolean;

  /**
   * Set to true if this endpoint response documentation should include cursor pagination metadata.
   * A true value for pagination forces a true value for hasMany.
   */
  pagination?: boolean;

  included?: Resource[];
};

type Document = {
  data: any;
  meta?: any;
  included?: any;
};

/**
 * Decorator to simplify wrapping the response type from a controller method with the JSON API
 * response structure. Builds the JSON:API document structure and applies the ApiExtraModels and
 * ApiResponse decorators.
 */
export function JsonApiResponse(options: ApiResponseOptions & JsonApiResponseProps) {
  const { data, hasMany, pagination, included, status, ...rest } = options;

  const extraModels: ResourceType[] = [data.type];
  const document = {
    data:
      hasMany || pagination
        ? {
            type: "array",
            items: {
              type: "object",
              properties: constructResource(data, { pagination })
            }
          }
        : {
            type: "object",
            properties: constructResource(data)
          }
  } as Document;

  if (included != null && included.length > 0) {
    for (const includedResource of included) {
      extraModels.push(includedResource.type);
      if (document.included == null) {
        document.included = {
          type: "array",
          items: {
            oneOf: []
          }
        };
      }
      document.included.items.oneOf.push({
        type: "object",
        properties: constructResource(includedResource)
      });
    }
  }

  if (pagination) {
    addMeta(document, "page", {
      type: "object",
      properties: {
        cursor: { type: "string", description: "The cursor for the first record on this page." },
        total: { type: "number", description: "The total number of records on this page.", example: 42 }
      }
    });
  }

  const apiResponseOptions = {
    ...rest,
    status: status ?? HttpStatus.OK,
    schema: {
      type: "object",
      properties: document
    }
  } as ApiResponseOptions;

  return applyDecorators(ApiResponse(apiResponseOptions), ApiExtraModels(...extraModels));
}
