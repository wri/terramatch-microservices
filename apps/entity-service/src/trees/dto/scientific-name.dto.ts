import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "treeSpeciesScientificNames", id: "string" })
export class ScientificNameDto extends JsonApiAttributes<ScientificNameDto> {
  @ApiProperty({
    description: "The scientific name for this tree species",
    example: "Abelia uniflora"
  })
  scientificName: string;
}
