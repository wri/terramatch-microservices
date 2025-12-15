/* eslint-disable @typescript-eslint/no-explicit-any */
/* istanbul ignore file */
import { DTO_TYPE_METADATA } from "../decorators/json-api-dto.decorator";
import { InternalServerErrorException, Type } from "@nestjs/common";
import { PaginationType } from "../decorators/json-api-response.decorator";
import { cloneDeep } from "lodash";
import * as qs from "qs";

type AttributeValue = string | number | boolean;
type Attributes = {
  [key: string]: AttributeValue | Attributes;
};

export type Relationship = {
  type: string;
  id: string;
  meta?: Attributes;
};

export type Relationships = {
  [key: string]: { data: Relationship | Relationship[] };
};

export type Resource = {
  type: string;
  id: string;
  attributes: Attributes;
  relationships?: Relationships;
  meta?: ResourceMeta;
};

type DocumentMeta = {
  resourceType: string;
  // Only supplied in the case of a delete
  resourceId?: string;
  indices?: IndexData[];
  deleted?: Deleted[];
};

type ResourceMeta = {
  page?: {
    cursor: string;
  };
};

export type JsonApiDocument = {
  data?: Resource | Resource[];
  included?: Resource[];
  meta: DocumentMeta;
};

export class ResourceBuilder {
  type: string;
  relationships?: Relationships;

  constructor(public id: string, public attributes: Attributes, private documentBuilder: DocumentBuilder) {
    this.type = Reflect.getMetadata(DTO_TYPE_METADATA, attributes.constructor);

    if (this.type == null && process.env["NODE_ENV"] !== "production") {
      throw new InternalServerErrorException(
        `Attribute types are required to use the @JsonApiDto decorator [${this.constructor.name}]`
      );
    }
  }

  get document() {
    return this.documentBuilder;
  }

  relateTo(
    label: string,
    resource: { id: string; type: string },
    { meta, forceMultiple = false }: { meta?: Attributes; forceMultiple?: boolean } = {}
  ): ResourceBuilder {
    if (this.relationships == null) this.relationships = {};

    // This method signature was created so that another resource builder could be passed in for the
    // "resource" argument, but that does mean we need to isolate just the props we want to include
    // in this relationship object.
    const { id, type } = resource;
    const relationship = { id, type, meta };
    if (this.relationships[label] == null) {
      this.relationships[label] = forceMultiple ? { data: [relationship] } : { data: relationship };
    } else if (Array.isArray(this.relationships[label].data)) {
      this.relationships[label].data.push(relationship);
    } else {
      this.relationships[label].data = [this.relationships[label].data, relationship];
    }

    return this;
  }

  serialize(): Resource {
    const resource = {
      type: this.type,
      id: this.id,
      attributes: this.attributes
    } as Resource;

    if (this.relationships != null) {
      resource.relationships = this.relationships;
    }

    if (this.documentBuilder.options?.pagination === "cursor") {
      resource.meta = {
        page: { cursor: this.id }
      };
    }

    return resource;
  }
}

export class ApiBuilderException extends Error {}

type DocumentBuilderOptions = {
  pagination?: PaginationType;
  /**
   * If true, the `data` member of the resulting response will always be an array, even if there's
   * only one member
   **/
  forceDataArray?: boolean;
};

export type SerializeOptions = {
  deletedResourceId?: string;
};

export type IndexData = {
  resource: string;
  requestPath: string;
  ids?: string[];
  total?: number;
  cursor?: string;
  pageNumber?: number;
};

export type Deleted = {
  resource: string;
  id: string;
};

export class DocumentBuilder {
  data: ResourceBuilder[] = [];
  included: ResourceBuilder[] = [];
  indexData: IndexData[] = [];
  deleted: Deleted[] = [];

  constructor(public readonly resourceType: string, public readonly options: DocumentBuilderOptions = {}) {}

  addData<DTO>(id: string, attributes: DTO): ResourceBuilder {
    const builder = new ResourceBuilder(id, attributes as Attributes, this);

    if (builder.type === this.resourceType) {
      const collision = this.data.find(({ id: existingId }) => existingId === id);
      if (collision != null) {
        throw new ApiBuilderException(`This resource is already in data [${id}]`);
      }

      this.data.push(builder);
    } else {
      const collision = this.included.find(({ type, id: existingId }) => existingId === id && type === builder.type);
      if (collision != null) {
        throw new ApiBuilderException(`This resource is already included [${id}, ${builder.type}]`);
      }

      this.included.push(builder);
    }

    return builder;
  }

  addIndex(indexData: Omit<IndexData, "resource"> & { resource?: string }): DocumentBuilder {
    const resource = indexData.resource ?? this.resourceType;
    const ids = resource === this.resourceType ? undefined : indexData.ids;
    if (resource !== this.resourceType && ids == null) {
      throw new ApiBuilderException(`Sideloaded indices must have an ids array`);
    }
    this.indexData.push({ ...indexData, resource, ids });
    return this;
  }

  /**
   * Adds deletions to the response that were the result of side effects on the API action
   */
  addDeletedResource(resource: string, id: string): DocumentBuilder {
    this.deleted.push({ resource, id });
    return this;
  }

  serialize({ deletedResourceId }: SerializeOptions = {}): JsonApiDocument {
    const singular = this.data.length === 1 && this.indexData.length === 0 && this.options.forceDataArray !== true;
    const doc: JsonApiDocument = {
      meta: { resourceType: this.resourceType }
    };

    if (deletedResourceId != null) {
      doc.meta.resourceId = deletedResourceId;
    } else {
      // Data can either be a single object or an array
      doc.data = singular ? this.data[0].serialize() : this.data.map(resource => resource.serialize());
    }

    if (this.included.length > 0) {
      // Included is always an array
      doc.included = this.included.map(resource => resource.serialize());
    }

    if (this.indexData.length > 0) {
      doc.meta.indices = this.indexData;
    }

    if (this.deleted.length > 0) {
      doc.meta.deleted = this.deleted;
    }

    return doc;
  }
}

export const getDtoType = <DTO>(dtoClass: Type<DTO>) => Reflect.getMetadata(DTO_TYPE_METADATA, dtoClass);

export const buildJsonApi = <DTO>(dtoClass: Type<DTO>, options?: DocumentBuilderOptions) =>
  new DocumentBuilder(getDtoType(dtoClass), options);

export const buildDeletedResponse = (resourceType: string, id: string, additionalDeleted?: Deleted[]) =>
  (additionalDeleted ?? [])
    .reduce(
      (document, { resource, id }) => document.addDeletedResource(resource, id),
      new DocumentBuilder(resourceType)
    )
    .serialize({ deletedResourceId: id });

export const getStableRequestQuery = (originalQuery: object) => {
  const normalizedQuery = cloneDeep(originalQuery) as { page?: { number?: number }; sideloads?: object[] };
  if (normalizedQuery.page?.number != null) delete normalizedQuery.page.number;
  if (normalizedQuery.sideloads != null) delete normalizedQuery.sideloads;

  // guarantee order of array query params.
  for (const value of Object.values(normalizedQuery)) {
    if (Array.isArray(value)) value.sort();
  }
  const query = qs.stringify(normalizedQuery, { arrayFormat: "indices", sort: (a, b) => a.localeCompare(b) });
  return query.length === 0 ? query : `?${query}`;
};
