import { DTO_TYPE_METADATA } from '@terramatch-microservices/common/decorators/json-api-dto.decorator';
import { InternalServerErrorException } from '@nestjs/common';

export class JsonApiAttributes<DTO> {
  type: string;

  constructor(props: Omit<DTO, "type">) {
    Object.assign(this, props);
    this.type = Reflect.getMetadata(DTO_TYPE_METADATA, this.constructor);

    if (this.type == null && process.env['NODE_ENV'] !== 'production') {
      throw new InternalServerErrorException(
        `DTO Types are required to use the @JsonApiDto decorator [${this.constructor.name}]`
      );
    }
  }
}
