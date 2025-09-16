import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { Dictionary } from "lodash";
import { PlantingCountMap } from "./planting-count.dto";
import { SpeciesDto } from "./species.dto";

// The ID for this DTO is formed of "entityType|entityUuid". This is a virtual resource, not directly
// backed by a single DB table.
@JsonApiDto({ type: "establishmentTrees", id: "string" })
export class EstablishmentsTreesDto {
  @ApiProperty({
    type: "object",
    additionalProperties: { type: "array", items: { $ref: "#/components/schemas/SpeciesDto" } },
    description:
      "The species that were specified at the establishment of the parent entity keyed by collection. " +
      'Note that for site reports, the seeds on the site establishment are included under the collection name "seeds"',
    example: {
      "tree-planted": [{ name: "Aster Peraliens" }, { name: "Circium carniolicum" }],
      "non-tree": [{ name: "Coffee" }]
    }
  })
  establishmentTrees: Dictionary<SpeciesDto[]>;

  @ApiProperty({
    type: "object",
    additionalProperties: {
      type: "object",
      additionalProperties: { $ref: "#/components/schemas/PlantingCountDto" }
    },
    nullable: true,
    description:
      "If the entity in this request is a report, the sum totals of previous planting by species by collection. " +
      "Note that for site reports, the seeds planted under previous site reports are included under the collection " +
      'name "seeds"',
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
  previousPlantingCounts?: PlantingCountMap;
}
