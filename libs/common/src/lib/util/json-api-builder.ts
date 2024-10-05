import { DTO_TYPE_METADATA } from '../decorators/json-api-dto.decorator';
import { InternalServerErrorException } from '@nestjs/common';

type AttributeValue = string | number | boolean;
type Attributes = {
  [key: string]: AttributeValue | Attributes
}

export type Relationship = {
  type: string;
  id: string;
  meta?: Attributes;
}

export type Relationships = {
  [key: string]: { data: Relationship | Relationship[] }
}

export type Resource = {
  type: string;
  id: string;
  attributes: Attributes;
  relationships?: Relationships;
}

export type JsonApiDocument = {
  data: Resource | Resource[];
  included?: Resource | Resource[];
}

export class ResourceBuilder {
  type: string;
  relationships?: Relationships;

  constructor(public id: string, public attributes: Attributes, private documentBuilder: DocumentBuilder) {
    this.type = Reflect.getMetadata(DTO_TYPE_METADATA, attributes.constructor);

    if (this.type == null && process.env['NODE_ENV'] !== 'production') {
      throw new InternalServerErrorException(
        `Attribute types are required to use the @JsonApiDto decorator [${this.constructor.name}]`
      );
    }
  }

  get document() {
    return this.documentBuilder;
  }

  relateTo(label: string, resource: { id: string, type: string }, meta?: Attributes): ResourceBuilder {
    if (this.relationships == null) this.relationships = {};

    // This method signature was created so that another resource builder could be passed in for the
    // "resource" argument, but that does mean we need to isolate just the props we want to include
    // in this relationship object.
    const { id, type } = resource;
    const relationship = { id, type, meta };
    if (this.relationships[label] == null) {
      this.relationships[label] = { data: relationship }
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
      attributes: this.attributes,
    } as Resource;

    if (this.relationships != null) {
      resource.relationships = this.relationships;
    }

    return resource;
  }
}

export class ApiBuilderException extends Error {}

class DocumentBuilder {
  data: ResourceBuilder[] = [];
  included: ResourceBuilder[] = [];

  addData(id: string, attributes: any): ResourceBuilder {
    const builder = new ResourceBuilder(id, attributes, this);

    const matchesType = this.data.length == 0 || this.data[0].type === builder.type;
    if (!matchesType) {
      throw new ApiBuilderException(`This resource does not match the data type [${builder.type}, ${this.data[0].type}]`)
    }

    const collision = this.data.find(({ id: existingId }) => existingId === id);
    if (collision != null) {
      throw new ApiBuilderException(`This resource is already in data [${id}]`);
    }

    this.data.push(builder);
    return builder;
  }

  addIncluded(id: string, attributes: any): ResourceBuilder {
    const builder = new ResourceBuilder(id, attributes, this);

    const collision = this.included.find(
      ({ type, id: existingId }) => existingId === id && type === builder.type
    );
    if (collision != null) {
      throw new ApiBuilderException(`This resource is already included [${id}, ${builder.type}]`);
    }

    this.included.push(builder);
    return builder;
  }

  serialize(): JsonApiDocument {
    if (this.data.length === 0) {
      throw new ApiBuilderException('Cannot build a document with no data!');
    }

    const doc: JsonApiDocument = {
      // Data can either be a single object or an array
      data: this.data.length === 1
        ? this.data[0].serialize()
        : this.data.map((resource) => resource.serialize())
    }

    if (this.included.length > 0) {
      // Included is always an array
      doc.included = this.included.map((resource) => resource.serialize());
    }

    return doc;
  }
}

export const buildJsonApi = () => new DocumentBuilder();
