import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";
import { Strata } from "@terramatch-microservices/database/entities/stratas.entity";
import { ApiProperty, OmitType } from "@nestjs/swagger";

@JsonApiDto({ type: "stratas" })
export class StrataDto extends AssociationDto {
  constructor(strata?: Strata, additional?: AssociationDtoAdditionalProps) {
    super();
    if (strata != null && additional != null) populateDto<StrataDto, Strata>(this, strata, additional);
  }

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated nursery name"
  })
  description: string | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "The associated nursery name"
  })
  extent: number | null;
}

export class EmbeddedStrataDto extends OmitType(StrataDto, ["entityType", "entityUuid"]) {
  constructor(strata: Strata) {
    super();
    populateDto<EmbeddedStrataDto>(this, strata);
  }

  @ApiProperty()
  uuid: string;
}
