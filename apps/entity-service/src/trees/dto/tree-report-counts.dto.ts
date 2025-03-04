import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { PlantingCountMap } from "./planting-count.dto";
import { ApiProperty } from "@nestjs/swagger";

// The ID for this DTO is formed of "entityType|entityUuid". This is a virtual resource, not directly
// backed by a single DB table.
@JsonApiDto({ type: "treeReportCounts", id: "string" })
export class TreeReportCountsDto extends JsonApiAttributes<TreeReportCountsDto> {
  @ApiProperty({
    type: "object",
    additionalProperties: {
      type: "object",
      additionalProperties: { $ref: "#/components/schemas/PlantingCountDto" }
    },
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
  reportCounts: PlantingCountMap;
}
