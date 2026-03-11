import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsIn } from "class-validator";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

const ORGANISATION_USER_STATUSES = ["requested", "approved", "rejected"] as const;
export type OrganisationUserStatus = (typeof ORGANISATION_USER_STATUSES)[number];

export class UserAssociationQueryDto {
  @ApiProperty({
    description: "Flag to filter by manager",
    required: false
  })
  @IsOptional()
  @TransformBooleanString()
  isManager?: boolean;

  @ApiProperty({
    description: "Filter by association status (for organisations: 'requested', 'approved', 'rejected')",
    required: false,
    enum: ORGANISATION_USER_STATUSES
  })
  @IsOptional()
  @IsIn(ORGANISATION_USER_STATUSES)
  status?: OrganisationUserStatus;
}
