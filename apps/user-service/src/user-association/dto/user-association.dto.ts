import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { User } from "@terramatch-microservices/database/entities";
import { ApiProperty } from "@nestjs/swagger";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "associatedUsers" })
export class UserAssociationDto {
  constructor(user: User) {
    populateDto<UserAssociationDto, User>(this, user, {});
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  emailAddress: string;
}
