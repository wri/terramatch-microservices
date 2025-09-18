import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { PlantingCountMap } from "./planting-count.dto";
import { ApiProperty } from "@nestjs/swagger";
import { Dictionary } from "lodash";
import { SpeciesDto } from "./species.dto";

// The ID for this DTO is formed of "entityType|entityUuid". This is a virtual resource, not directly
// backed by a single DB table.
@JsonApiDto({ type: "treeReportCounts", id: "string" })
export class TreeReportCountsDto {
  @ApiProperty({
    type: "object",
    additionalProperties: { type: "array", items: { $ref: "#/components/schemas/SpeciesDto" } },
    nullable: true,
    description:
      "The species that were specified at the establishment of the parent entity grouped by collection. " +
      "This will be null for projects because projects don't have a parent entity. " +
      'Note that for site reports, the seeds on the site establishment are included under the collection name "seeds"',
    example: {
      "tree-planted": [{ name: "Aster Peraliens" }, { name: "Circium carniolicum" }],
      "non-tree": [{ name: "Coffee" }]
    }
  })
  establishmentTrees?: Dictionary<SpeciesDto[]>;

  @ApiProperty({
    type: "object",
    additionalProperties: {
      type: "object",
      additionalProperties: { $ref: "#/components/schemas/PlantingCountDto" }
    },
    nullable: true,
    description:
      "Returns the planting counts of all species on reports associated with this entity, grouped by collection." +
      "If the entity is a project or site, it returns data for all site reports under that Project or Site. " +
      "If the entity is a project report, it returns data for all site reports within the same reporting task. " +
      'Note that seeding data is returned on this same endpoint under the collection name "seeds"',
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
  reportCounts?: PlantingCountMap;
}
