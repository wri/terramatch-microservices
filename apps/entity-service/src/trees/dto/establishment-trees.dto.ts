import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";

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
    type: [String],
    description: "The species that were specified at the establishment of the parent entity."
  })
  establishmentTrees: string[];

  @ApiProperty({
    type: "object",
    additionalProperties: { $ref: "#/components/schemas/PreviousPlantingCountDto" },
    nullable: true,
    description: "If the entity in this request is a report, the sum totals of previous planting by species.",
    example: { "Aster persaliens": { amount: 256 }, "Cirsium carniolicum": { taxonId: "wfo-0000130112", amount: 1024 } }
  })
  previousPlantingCounts?: Record<string, PreviousPlantingCountDto>;
}
