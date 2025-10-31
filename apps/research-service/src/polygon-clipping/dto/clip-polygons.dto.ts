import { IsUUID, IsArray, IsOptional, IsString } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { FeatureCollection, Polygon, MultiPolygon } from "geojson";

export class ClipPolygonByUuidDto {
  @ApiProperty({
    description: "UUID of the polygon to clip",
    example: "550e8400-e29b-41d4-a716-446655440000"
  })
  @IsUUID()
  uuid: string;
}

export class ClipPolygonsBySiteDto {
  @ApiProperty({
    description: "UUID of the site",
    example: "550e8400-e29b-41d4-a716-446655440001"
  })
  @IsUUID()
  siteUuid: string;
}

export class ClipPolygonsRequestDto {
  @ApiProperty({
    description: "Array of polygon UUIDs to clip",
    example: ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440002"]
  })
  @IsArray()
  @IsUUID("4", { each: true })
  uuids: string[];

  @ApiProperty({
    description: "Entity UUID (e.g., site UUID)",
    example: "550e8400-e29b-41d4-a716-446655440001",
    required: false
  })
  @IsOptional()
  @IsUUID()
  entity_uuid?: string;

  @ApiProperty({
    description: "Entity type (e.g., 'sites')",
    example: "sites",
    required: false
  })
  @IsOptional()
  @IsString()
  entity_type?: string;
}

export class ClipPolygonsResponseDto {
  @ApiProperty({
    description: "Updated polygons as GeoJSON FeatureCollection"
  })
  updated_polygons: FeatureCollection<Polygon | MultiPolygon>;

  @ApiProperty({
    description: "Number of polygons clipped",
    example: 5
  })
  clipped_count: number;

  @ApiProperty({
    description: "Total number of polygons processed",
    example: 10
  })
  total_processed: number;

  @ApiProperty({
    description: "Array of polygon UUIDs that were modified",
    example: ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440002"]
  })
  modified_polygon_uuids: string[];
}
