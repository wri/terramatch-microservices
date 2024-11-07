import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "../decorators";
import { JsonApiAttributes } from "./json-api-attributes";
import { Framework, User } from "@terramatch-microservices/database/entities";

class UserFramework {
  @ApiProperty({ example: "TerraFund Landscapes" })
  name: string;

  @ApiProperty({ example: "terrafund-landscapes" })
  slug: string;
}

@JsonApiDto({ type: "users" })
export class UserDto extends JsonApiAttributes<UserDto> {
  constructor(user: User, frameworks: Framework[]) {
    super({
      ...user,
      uuid: user.uuid ?? "",
      fullName: user.firstName == null || user.lastName == null ? null : `${user.firstName} ${user.lastName}`,
      primaryRole: user.primaryRole,
      frameworks: frameworks.map(({ name, slug }) => ({ name, slug }))
    });
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true })
  firstName: string | null;

  @ApiProperty({ nullable: true })
  lastName: string | null;

  @ApiProperty({ nullable: true, description: "Currently just calculated by appending lastName to firstName." })
  fullName: string | null;

  @ApiProperty()
  primaryRole: string;

  @ApiProperty({ example: "person@foocorp.net" })
  emailAddress: string;

  @ApiProperty({ nullable: true })
  emailAddressVerifiedAt: Date | null;

  @ApiProperty({ nullable: true })
  locale: string | null;

  @ApiProperty({ type: () => UserFramework, isArray: true })
  frameworks: UserFramework[];
}
