import { ApiProperty } from '@nestjs/swagger';
import { JsonApiDto } from '../decorators';
import { JsonApiAttributes } from './json-api-attributes';
import { Framework, User } from '@terramatch-microservices/database/entities';

class UserFramework  {
  @ApiProperty({ example: 'TerraFund Landscapes' })
  name: string;

  @ApiProperty({ example: 'terrafund-landscapes' })
  slug: string;
}

@JsonApiDto({ type: 'users' })
export class UserDto extends JsonApiAttributes<UserDto> {
  constructor(user: User, frameworks: Framework[]) {
    super({
      uuid: user.uuid ?? '',
      firstName: user.firstName,
      lastName: user.lastName,
      fullName:
        user.firstName == null || user.lastName == null
          ? null
          : `${user.firstName} ${user.lastName}`,
      primaryRole: user.primaryRole,
      emailAddress: user.emailAddress,
      emailAddressVerifiedAt: user.emailAddressVerifiedAt,
      locale: user.locale,
      frameworks: frameworks.map(({ name, slug }) => ({ name, slug }))
    })
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  firstName: string | null;

  @ApiProperty()
  lastName: string | null;

  @ApiProperty({ description: 'Currently just calculated by appending lastName to firstName.' })
  fullName: string | null;

  @ApiProperty()
  primaryRole: string;

  @ApiProperty({ example: 'person@foocorp.net' })
  emailAddress: string;

  @ApiProperty()
  emailAddressVerifiedAt: Date | null;

  @ApiProperty()
  locale: string | null;

  @ApiProperty({ type: () => UserFramework, isArray: true })
  frameworks: UserFramework[]
}