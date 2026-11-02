import { ApiProperty } from "@nestjs/swagger";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { FRAMEWORK_ADMIN_ROLES, ROLE_NAMES, RoleSlug } from "@terramatch-microservices/database/constants/permissions";

@JsonApiConstants
export class Roles {
  @ApiProperty({ example: ROLE_NAMES })
  ROLE_NAMES: Record<RoleSlug, string>;

  @ApiProperty({
    example: FRAMEWORK_ADMIN_ROLES,
    description: "The only roles that may be combined with other roles; all other roles must be held alone."
  })
  COMBINABLE_ROLES: RoleSlug[];
}
