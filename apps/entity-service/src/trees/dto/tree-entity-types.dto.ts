import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { ESTABLISHMENT_ENTITIES, REPORT_COUNT_ENTITIES } from "../tree.service";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiConstants
export class TreeEntityTypes {
  @ApiProperty({ example: ESTABLISHMENT_ENTITIES })
  ESTABLISHMENT_ENTITIES: string[];

  @ApiProperty({ example: REPORT_COUNT_ENTITIES })
  REPORT_COUNT_ENTITIES: string[];
}
