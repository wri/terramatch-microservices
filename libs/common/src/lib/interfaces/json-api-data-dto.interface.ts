import { JsonApiAttributes } from '@terramatch-microservices/common/dto/json-api-attributes';

export type JsonApiDto<TAttributes> = {
  id: string;
  attributes: JsonApiAttributes<TAttributes>;
}
