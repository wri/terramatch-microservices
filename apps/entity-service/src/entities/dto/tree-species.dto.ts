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

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({ nullable: true, type: Number })
  amount: number | null;

  @ApiProperty({ nullable: true, type: String })
  taxonId: string | null;

  @ApiProperty({ nullable: true, type: String })
  collection: string | null;
}
