import { ApiProperty } from "@nestjs/swagger";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { FRAMEWORK_NAMES, FrameworkKey } from "@terramatch-microservices/database/constants/framework";

@JsonApiConstants
export class Frameworks {
  @ApiProperty({ example: FRAMEWORK_NAMES })
  FRAMEWORK_NAMES: Record<FrameworkKey, string>;
}
