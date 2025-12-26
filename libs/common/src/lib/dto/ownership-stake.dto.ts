import { ApiProperty } from "@nestjs/swagger";
import { OwnershipStake } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";

// TODO most of these fields will migrate to a full response DTO when we need one.
export class EmbeddedOwnershipStakeDto {
  constructor(ownershipStake: OwnershipStake) {
    populateDto<EmbeddedOwnershipStakeDto>(this, ownershipStake);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  organisationId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  gender: string;

  @ApiProperty()
  percentOwnership: number;

  @ApiProperty()
  yearOfBirth: number;
}
