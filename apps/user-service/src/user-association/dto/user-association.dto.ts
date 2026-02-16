import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { User } from "@terramatch-microservices/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

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

  @ApiProperty()
  status: string;

  @ApiProperty()
  isManager: boolean;
}
