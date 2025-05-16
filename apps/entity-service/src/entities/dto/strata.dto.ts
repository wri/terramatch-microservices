import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";
import { Strata } from "@terramatch-microservices/database/entities/stratas.entity";
import { ApiProperty } from "@nestjs/swagger";

@JsonApiDto({ type: "stratas" })
export class StrataDto extends AssociationDto {
  constructor(strata: Strata, additional: AssociationDtoAdditionalProps) {
    super();
    populateDto<StrataDto, Strata>(this, strata, additional);
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
