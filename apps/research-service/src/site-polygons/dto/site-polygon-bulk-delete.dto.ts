import { DeleteDataDto, JsonApiBulkBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class SitePolygonBulkDeleteBodyDto extends JsonApiBulkBodyDto(
  class SitePolygonDeleteData extends DeleteDataDto({ type: "sitePolygons", id: "uuid" }) {},
  {
    minSize: 1,
    minSizeMessage: "At least one site polygon must be provided",
    description: "Array of site polygon resource identifiers to delete",
    example: [
      { type: "sitePolygons", id: "123e4567-e89b-12d3-a456-426614174000" },
      { type: "sitePolygons", id: "123e4567-e89b-12d3-a456-426614174001" }
    ]
  }
) {}
