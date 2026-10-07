import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsIn } from "class-validator";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";
import {
  ORGANISATION_USER_STATUSES,
  OrganisationUserStatus
} from "@terramatch-microservices/database/constants/status";

export class UserAssociationQueryDto {
  @ApiProperty({
    description: "Flag to filter by manager",
    required: false
  })
  @IsOptional()
  @TransformBooleanString()
  isManager?: boolean;

  @ApiProperty({
    description: "Filter by association status (organisations only)",
    required: false,
    enum: ORGANISATION_USER_STATUSES
  })
  @IsOptional()
  @IsIn(ORGANISATION_USER_STATUSES)
  status?: OrganisationUserStatus;
}
