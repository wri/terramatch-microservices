import { ApiProperty } from "@nestjs/swagger";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { ROLE_NAMES, RoleSlug } from "@terramatch-microservices/database/constants/permissions";

@JsonApiConstants
export class Roles {
  @ApiProperty({ example: ROLE_NAMES })
  ROLE_NAMES: Record<RoleSlug, string>;
}
