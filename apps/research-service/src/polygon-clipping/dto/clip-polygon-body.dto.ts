import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID } from "class-validator";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

/**
 * Attributes for site polygon clipping request
 */
export class SitePolygonClippingAttributes {
  // No attributes needed - site UUID comes from URL param
}

/**
 * Attributes for project polygon clipping request
 */
export class ProjectPolygonClippingAttributes {
  // No attributes needed - site UUID (for project lookup) comes from URL param
}

/**
 * Attributes for custom polygon list clipping request
 */
export class PolygonListClippingAttributes {
  @ApiProperty({
    description: "Array of polygon UUIDs to check and clip for fixable overlaps",
    example: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"],
    type: [String]
  })
  @IsArray()
  @IsUUID(4, { each: true })
  polygonUuids: string[];
}

/**
 * JSON:API request body for site polygon clipping
 */
export class SitePolygonClippingRequestBody extends JsonApiBodyDto(
  class SitePolygonClippingData extends CreateDataDto("polygon-clipping", SitePolygonClippingAttributes) {}
) {}

/**
 * JSON:API request body for project polygon clipping
 */
export class ProjectPolygonClippingRequestBody extends JsonApiBodyDto(
  class ProjectPolygonClippingData extends CreateDataDto("polygon-clipping", ProjectPolygonClippingAttributes) {}
) {}

/**
 * JSON:API request body for custom polygon list clipping
 */
export class PolygonListClippingRequestBody extends JsonApiBodyDto(
  class PolygonListClippingData extends CreateDataDto("polygon-clipping", PolygonListClippingAttributes) {}
) {}
