import { ApiProperty } from '@nestjs/swagger';
import { JsonApiDto } from '../decorators';
import { JsonApiAttributes } from './json-api-attributes';
import { User } from '@terramatch-microservices/database/entities';

const USER_ORG_STATUSES = ['rejected', 'approved', 'requested'] as const;
type UserOrgStatus = (typeof USER_ORG_STATUSES)[number];

class UserOrg {
  @ApiProperty({ format: 'uuid' })
  uuid: string;

  @ApiProperty({ enum: USER_ORG_STATUSES })
  status: UserOrgStatus;
}

@JsonApiDto({ type: 'users' })
export class UserDto extends JsonApiAttributes<UserDto> {
  constructor(user: User) {
    super({
      firstName: user.firstName,
      lastName: user.lastName,
      fullName:
        user.firstName == null || user.lastName == null
          ? null
          : `${user.firstName} ${user.lastName}`,
      primaryRole: 'asdfasdfasdf',
      emailAddress: user.emailAddress,
      emailAddressVerifiedAt: user.emailAddressVerifiedAt,
      locale: user.locale,
    })
  }

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
  //
  // @ApiProperty()
  // organisation?: UserOrg;
}


// In use:
//   uuid?: string;
// firstName
// lastName
// fullName: derived from firstName / lastName
// role
//   email_address?: string;
//   email_address_verified_at?: string;
// organisationId (can be null)
//   frameworks?: {
//     name?: string;
//     slug?: string;
//   }[];
// not actually in use, but I think we should include it
//   locale?: string;

// organisation: side load, can be null
// uuid
// status
// usersStatus (?)
// name
