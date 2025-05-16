import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportDto } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { ENTITY_TYPES } from "@terramatch-microservices/database/constants/entities";

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
