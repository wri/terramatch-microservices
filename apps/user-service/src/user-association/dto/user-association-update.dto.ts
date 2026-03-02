import { IsIn } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

const USER_ASSOCIATION_STATUSES = ["approved", "rejected"] as const;
export type UserAssociationStatus = (typeof USER_ASSOCIATION_STATUSES)[number];

export class UserAssociationUpdateAttributes {
  @IsIn(USER_ASSOCIATION_STATUSES)
  @ApiProperty({ enum: USER_ASSOCIATION_STATUSES, description: "Status to set for the user association" })
  status: UserAssociationStatus;
}

export class UserAssociationUpdateData extends CreateDataDto("associatedUsers", UserAssociationUpdateAttributes) {}

export class UserAssociationUpdateBody extends JsonApiBodyDto(UserAssociationUpdateData) {}
