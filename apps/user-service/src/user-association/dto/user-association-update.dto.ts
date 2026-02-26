import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

const ORG_USER_STATUSES = ["approved", "rejected"] as const;
type OrgUserStatus = (typeof ORG_USER_STATUSES)[number];

export class UserAssociationUpdateAttributes {
  @IsIn(ORG_USER_STATUSES)
  @ApiProperty({ enum: ORG_USER_STATUSES })
  status: OrgUserStatus;
}

export class UserAssociationUpdateBody extends JsonApiBodyDto(
  class UserAssociationUpdateData extends CreateDataDto("associatedUsers", UserAssociationUpdateAttributes) {}
) {}
