import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";
import { TreeSpecies } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "treeSpecies" })
export class TreeSpeciesDto extends AssociationDto {
  constructor(treeSpecies: TreeSpecies, additional: AssociationDtoAdditionalProps) {
    super();
    populateDto<TreeSpeciesDto, TreeSpecies>(this, treeSpecies, additional);
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ required: false })
  name: string | null;

  @ApiProperty({ required: false })
  amount: number | null;

  @ApiProperty({ required: false })
  taxonId: string | null;

  @ApiProperty({ required: false })
  collection: string | null;
}
