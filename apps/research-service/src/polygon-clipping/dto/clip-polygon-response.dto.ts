import { ApiProperty } from "@nestjs/swagger";
import { Polygon, MultiPolygon, FeatureCollection } from "geojson";

export class PolygonClippingResponseDto {
  @ApiProperty({
    description: "UUID of the clipped polygon",
    example: "550e8400-e29b-41d4-a716-446655440000"
  })
  polygonUuid: string;

  @ApiProperty({
    description: "Name of the polygon",
    example: "Polygon A"
  })
  polygonName: string;

  @ApiProperty({
    description: "Original area in hectares before clipping",
    example: 10.5
  })
  originalAreaHa: number;

  @ApiProperty({
    description: "New area in hectares after clipping",
    example: 10.3
  })
  newAreaHa: number;

  @ApiProperty({
    description: "Area removed in hectares",
    example: 0.2
  })
  areaRemovedHa: number;

  @ApiProperty({
    description: "Clipped geometry as GeoJSON"
  })
  clippedGeometry: Polygon | MultiPolygon;

  @ApiProperty({
    description: "GeoJSON FeatureCollection containing the clipped polygon"
  })
  geojson: FeatureCollection<Polygon | MultiPolygon>;
}

export class ClippingSummaryDto {
  @ApiProperty({
    description: "Total number of polygons processed",
    example: 5
  })
  totalPolygons: number;

  @ApiProperty({
    description: "Number of polygons that were clipped",
    example: 2
  })
  clippedPolygons: number;

  @ApiProperty({
    description: "Total area removed in hectares",
    example: 0.45
  })
  totalAreaRemovedHa: number;
}
