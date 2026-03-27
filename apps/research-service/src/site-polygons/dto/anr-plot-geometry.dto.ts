import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { AnrPlotGeometry } from "@terramatch-microservices/database/entities";
import { FeatureCollection, Geometry } from "geojson";

@JsonApiDto({ type: "anrPlotGeometries" })
export class AnrPlotGeometryDto {
  constructor(record: AnrPlotGeometry, sitePolygonUuid: string) {
    populateDto<AnrPlotGeometryDto, AnrPlotGeometry>(this, record, {
      sitePolygonUuid
    });
    this.geojson = record.geojson as FeatureCollection<
      Geometry,
      { plotId?: number; areaM2?: number; select?: string | null } | null
    >;
  }

  @ApiProperty({
    description: "The site polygon UUID this plot grid belongs to",
    example: "123e4567-e89b-12d3-a456-426614174000"
  })
  sitePolygonUuid: string;

  @ApiProperty({
    description: "GeoJSON FeatureCollection of ANR monitoring plot grid",
    type: "object",
    properties: {
      type: { type: "string", enum: ["FeatureCollection"] },
      features: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["Feature"] },
            geometry: { type: "object" },
            properties: {
              type: "object",
              properties: {
                plotId: { type: "integer", example: 37 },
                areaM2: { type: "integer", example: 897 },
                select: { type: "string", nullable: true, example: "Yes" }
              }
            }
          }
        }
      }
    }
  })
  geojson: FeatureCollection<Geometry, { plotId?: number; areaM2?: number; select?: string | null } | null>;

  @ApiProperty({
    description: "Cached count of plot features in the FeatureCollection",
    nullable: true,
    type: Number
  })
  plotCount: number | null;

  @ApiProperty({
    description: "User ID of the Admin who uploaded this grid",
    nullable: true,
    type: Number
  })
  createdBy: number | null;
}
