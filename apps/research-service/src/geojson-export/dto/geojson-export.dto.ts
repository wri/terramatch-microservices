import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { Feature, FeatureCollection } from "geojson";

@JsonApiDto({ type: "geojsonExports" })
export class GeoJsonExportDto {
  constructor(featureCollection: FeatureCollection) {
    this.type = featureCollection.type;
    this.features = featureCollection.features;
  }

  @ApiProperty({ enum: ["FeatureCollection"], example: "FeatureCollection" })
  type: "FeatureCollection";

  @ApiProperty({
    description: "Array of GeoJSON Feature objects",
    type: "array",
    items: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["Feature"] },
        geometry: { type: "object" },
        properties: { type: "object", nullable: true }
      }
    },
    example: [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [0, 0],
              [0, 1],
              [1, 1],
              [1, 0],
              [0, 0]
            ]
          ]
        },
        properties: {
          uuid: "123e4567-e89b-12d3-a456-426614174000",
          polyName: "Forest Plot A",
          plantStart: "2024-01-01",
          practice: ["reforestation"],
          targetSys: "agroforestry",
          distr: ["Northern Region"],
          numTrees: 1500,
          siteId: "123e4567-e89b-12d3-a456-426614174001"
        }
      }
    ]
  })
  features: Feature[];
}
