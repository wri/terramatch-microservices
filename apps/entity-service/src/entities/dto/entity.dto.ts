import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportDto } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { ENTITY_TYPES } from "@terramatch-microservices/database/constants/entities";

/**
 * A utility type for constructing the "extra props" type of a DTO based on what's in the dto, the
 * base type (e.g. the light DTO & base model for a full DTO)
 */
export type AdditionalProps<DTO, BaseType> = Pick<DTO, keyof Omit<DTO, keyof BaseType>>;

@JsonApiConstants
export class SupportedEntities {
  @ApiProperty({ example: ENTITY_TYPES })
  ENTITY_TYPES: string[];
}

export abstract class EntityDto extends HybridSupportDto {
  /**
   * All EntityDtos must include UUID in the attributes for use in the react-admin pagination
   * code.
   */
  @ApiProperty()
  uuid: string;
}
