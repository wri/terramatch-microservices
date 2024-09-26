import { JsonApiDataDto } from '../interfaces';
import { ApiProperty } from '@nestjs/swagger';

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

  @ApiProperty({ format: 'uuid' })
  organisationUuid?: string;
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
