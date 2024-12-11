import { JsonApiAttributes } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";

// The ID for this DTO is formed of "entityType|entityUuid". This is a virtual resource, not directly
// backed by a single DB table.
@JsonApiDto({ type: "establishmentTrees", id: "string" })
export class EstablishmentsTreesDto extends JsonApiAttributes<EstablishmentsTreesDto> {
  @ApiProperty({
    type: [String],
    description: "The species that were specified at the establishment of the parent entity."
  })
  establishmentTrees: string[];
}
