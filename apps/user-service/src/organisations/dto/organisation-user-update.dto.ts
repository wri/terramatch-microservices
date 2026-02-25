import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";

const ORGANISATION_USER_STATUSES = ["approved", "rejected"] as const;
type OrganisationUserStatus = (typeof ORGANISATION_USER_STATUSES)[number];

export class OrganisationUserUpdateAttributes {
  @IsIn(ORGANISATION_USER_STATUSES)
  @ApiProperty({ enum: ORGANISATION_USER_STATUSES })
  status: OrganisationUserStatus;
}

export class OrganisationUserUpdateBody extends JsonApiBodyDto(
  class OrganisationUserUpdateData extends JsonApiDataDto({ type: "users" }, OrganisationUserUpdateAttributes) {}
) {}
