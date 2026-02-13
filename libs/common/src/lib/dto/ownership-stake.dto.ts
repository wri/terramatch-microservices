import { ApiProperty, OmitType } from "@nestjs/swagger";
import { OwnershipStake } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";
import { AssociationDto } from "./association.dto";
import { JsonApiDto } from "../decorators";
import { HybridSupportProps } from "./hybrid-support.dto";

@JsonApiDto({ type: "ownershipStakes" })
export class OwnershipStakeDto extends AssociationDto {
  constructor(ownershipStake?: OwnershipStake, props?: HybridSupportProps<OwnershipStakeDto, OwnershipStake>) {
    super();
    if (ownershipStake != null && props != null) {
      populateDto<OwnershipStakeDto, OwnershipStake>(this, ownershipStake, props);
    }
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

// TODO most of these fields will migrate to a full response DTO when we need one.
export class EmbeddedOwnershipStakeDto extends OmitType(OwnershipStakeDto, ["entityType", "entityUuid"]) {
  constructor(ownershipStake: OwnershipStake) {
    super();
    populateDto<EmbeddedOwnershipStakeDto>(this, ownershipStake);
  }
}
