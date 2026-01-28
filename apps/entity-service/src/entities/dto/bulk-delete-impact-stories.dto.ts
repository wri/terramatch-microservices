import { DeleteDataDto, JsonApiBulkBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class ImpactStoryBulkDeleteBodyDto extends JsonApiBulkBodyDto(
  class ImpactStoryDeleteData extends DeleteDataDto({ type: "impactStories", id: "uuid" }) {},
  {
    minSize: 1,
    minSizeMessage: "At least one impact story must be provided",
    description: "Array of impact story resource identifiers to delete",
    example: [
      { type: "impactStories", id: "123e4567-e89b-12d3-a456-426614174000" },
      { type: "impactStories", id: "123e4567-e89b-12d3-a456-426614174001" }
    ]
  }
) {}
