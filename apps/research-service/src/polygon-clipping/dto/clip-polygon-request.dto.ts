import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID } from "class-validator";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class SitePolygonClippingAttributes {
  @ApiProperty({
    description: "UUID of the site whose polygons should be clipped",
    example: "550e8400-e29b-41d4-a716-446655440000"
  })
  @IsUUID(4)
  siteUuid: string;
}

export class ProjectPolygonClippingAttributes {
  @ApiProperty({
    description: "UUID of the site to find project polygons",
    example: "550e8400-e29b-41d4-a716-446655440000"
  })
  @IsUUID(4)
  siteUuid: string;
}

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

export class SitePolygonClippingRequestBody extends JsonApiBodyDto(
  class SitePolygonClippingData extends CreateDataDto("polygon-clipping", SitePolygonClippingAttributes) {}
) {}

export class ProjectPolygonClippingRequestBody extends JsonApiBodyDto(
  class ProjectPolygonClippingData extends CreateDataDto("polygon-clipping", ProjectPolygonClippingAttributes) {}
) {}

export class PolygonListClippingRequestBody extends JsonApiBodyDto(
  class PolygonListClippingData extends CreateDataDto("polygon-clipping", PolygonListClippingAttributes) {}
) {}
