/* istanbul ignore file */
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "../decorators";
import { populateDto } from "./json-api-attributes";
import { Framework, User } from "@terramatch-microservices/database/entities";

class UserFramework {
  @ApiProperty({ example: "TerraFund Landscapes" })
  name: string;

  @ApiProperty({ example: "terrafund-landscapes" })
  slug: string;
}

@JsonApiDto({ type: "users" })
export class UserDto {
  constructor(user: User, frameworks: Framework[]) {
    populateDto<UserDto, Omit<User, "uuid" | "frameworks">>(this, user, {
      uuid: user.uuid ?? "",
      frameworks: frameworks
        .filter(({ slug }) => slug != null)
        .map(({ name, slug }) => ({ name, slug })) as UserFramework[]
    });
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: String })
  firstName: string | null;

  @ApiProperty({ nullable: true, type: String })
  lastName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "Currently just calculated by appending lastName to firstName."
  })
  fullName: string | null;

  @ApiProperty()
  primaryRole: string;

  @ApiProperty({ example: "person@foocorp.net" })
  emailAddress: string;

  @ApiProperty({ nullable: true, type: Date })
  emailAddressVerifiedAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  locale: string | null;

  @ApiProperty({ type: () => UserFramework, isArray: true })
  frameworks: UserFramework[];
}
