import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ArrayMinSize } from "class-validator";
import { FeatureCollection } from "geojson";

export class GeometryRequestDto {
  @ApiProperty({
    description: "Array of standard GeoJSON FeatureCollection objects",
    example: [
      {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [-74.006, 40.7128]
            },
            properties: {
              site_id: "site-123",
              est_area: 1.5
            }
          }
        ]
      }
    ]
  })
  @IsArray()
  @ArrayMinSize(1)
  geometries: FeatureCollection[];
}
