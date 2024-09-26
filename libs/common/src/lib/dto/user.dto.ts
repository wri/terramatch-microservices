import { JsonApiDataDto } from '../interfaces';
import { ApiProperty } from '@nestjs/swagger';

const USER_ORG_STATUSES = ['rejected', 'approved', 'requested'] as const;
type UserOrgStatus = (typeof USER_ORG_STATUSES)[number];

class UserOrg {
  @ApiProperty({ format: 'uuid' })
  uuid: string;

  @ApiProperty({ enum: USER_ORG_STATUSES })
  status: UserOrgStatus;
}

export class UserDto implements JsonApiDataDto {
  @ApiProperty({ example: 'users' })
  type: string;

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName?: string;

  @ApiProperty()
  lastName?: string;

  @ApiProperty({ description: 'Currently just calculated by appending lastName to firstName.' })
  fullName?: string;

  @ApiProperty()
  primaryRole: string;

  @ApiProperty({ example: 'person@foocorp.net' })
  emailAddress: string;

  @ApiProperty()
  emailAddressVerifiedAt?: Date;

  @ApiProperty()
  locale?: string;

  @ApiProperty()
  organisation?: UserOrg;
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
