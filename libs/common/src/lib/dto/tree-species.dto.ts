import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";
import { TreeSpecies } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";
import { ApiProperty, OmitType } from "@nestjs/swagger";
import { JsonApiDto } from "../decorators";

@JsonApiDto({ type: "treeSpecies" })
export class TreeSpeciesDto extends AssociationDto {
  constructor(treeSpecies?: TreeSpecies, additional?: AssociationDtoAdditionalProps) {
    super();
    if (treeSpecies != null && additional != null)
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

export class EmbeddedTreeSpeciesDto extends OmitType(TreeSpeciesDto, ["entityType", "entityUuid"]) {
  constructor(treeSpecies: TreeSpecies) {
    super();
    if (treeSpecies != null) populateDto<EmbeddedTreeSpeciesDto>(this, treeSpecies);
  }
}
