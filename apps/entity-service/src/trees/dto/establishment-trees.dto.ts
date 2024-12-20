import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { Dictionary } from "lodash";

export class PreviousPlantingCountDto {
  @ApiProperty({ nullable: true, description: "Taxonomic ID for this tree species row" })
  taxonId?: string;

  @ApiProperty({
    description: "Number of trees of this type that have been planted in all previous reports on this entity."
  })
  amount: number;
}

// The ID for this DTO is formed of "entityType|entityUuid". This is a virtual resource, not directly
// backed by a single DB table.
@JsonApiDto({ type: "establishmentTrees", id: "string" })
export class EstablishmentsTreesDto extends JsonApiAttributes<EstablishmentsTreesDto> {
  @ApiProperty({
    type: "object",
    additionalProperties: { type: "array", items: { type: "string" } },
    description: "The species that were specified at the establishment of the parent entity keyed by collection",
    example: { "tree-planted": ["Aster Peraliens", "Circium carniolicum"], "non-tree": ["Coffee"] }
  })
  establishmentTrees: Dictionary<string[]>;

  @ApiProperty({
    type: "object",
    additionalProperties: {
      type: "object",
      additionalProperties: { $ref: "#/components/schemas/PreviousPlantingCountDto" }
    },
    nullable: true,
    description:
      "If the entity in this request is a report, the sum totals of previous planting by species by collection.",
    example: {
      "tree-planted": {
        "Aster persaliens": { amount: 256 },
        "Cirsium carniolicum": { taxonId: "wfo-0000130112", amount: 1024 }
      },
      "non-tree": {
        Coffee: { amount: 2048 }
      }
    }
  })
  previousPlantingCounts?: Dictionary<Dictionary<PreviousPlantingCountDto>>;
}
