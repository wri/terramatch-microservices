import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { User } from "@terramatch-microservices/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import {
  ORGANISATION_USER_STATUSES,
  OrganisationUserStatus
} from "@terramatch-microservices/database/constants/status";

@JsonApiDto({ type: "associatedUsers" })
export class UserAssociationDto {
  constructor(user: User, additional?: AdditionalProps<UserAssociationDto, User>) {
    if (user != null && additional != null) {
      populateDto<UserAssociationDto, User>(this, user, additional);
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  emailAddress: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty({
    nullable: true,
    type: String,
    enum: ORGANISATION_USER_STATUSES,
    description: "Organisation membership status. Always null for project associations."
  })
  status: OrganisationUserStatus | null;

  @ApiProperty()
  isManager: boolean;

  @ApiProperty()
  organisationName: string;

  @ApiProperty({ nullable: true, type: String })
  roleName: string | null;

  @ApiProperty({ nullable: true, type: String })
  phoneNumber: string | null;

  @ApiProperty({ nullable: true, type: String })
  jobRole: string | null;

  @ApiProperty({ nullable: true, type: String })
  lastLoggedInAt: string | null;

  @ApiProperty()
  associatedType: string;
}
