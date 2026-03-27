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
  constructor(user: User, directFrameworks: Framework[], frameworks: Framework[]) {
    populateDto<UserDto, Omit<User, "uuid" | "frameworks">>(this, user, {
      uuid: user.uuid ?? "",
      organisationName: user.organisation?.name ?? null,
      organisationUuid: user.organisation?.uuid ?? null,
      frameworks: (frameworks ?? [])
        .filter(({ slug }) => slug != null)
        .map(({ name, slug }) => ({ name, slug })) as UserFramework[],
      directFrameworks: (directFrameworks ?? [])
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
  phoneNumber: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Name of the user's primary organisation, if any." })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String, description: "UUID of the user's primary organisation, if any." })
  organisationUuid: string | null;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ nullable: true, type: Date })
  lastLoggedInAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  jobRole: string | null;

  @ApiProperty({ nullable: true, type: String })
  country: string | null;

  @ApiProperty({ nullable: true, type: String })
  program: string | null;

  @ApiProperty({ nullable: true, type: String })
  locale: string | null;

  @ApiProperty({ type: () => UserFramework, isArray: true })
  frameworks: UserFramework[];

  @ApiProperty({ type: () => UserFramework, isArray: true })
  directFrameworks: UserFramework[];
}
