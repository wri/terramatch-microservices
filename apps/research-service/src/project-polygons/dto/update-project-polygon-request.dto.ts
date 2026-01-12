import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { JsonApiBodyDto, JsonApiDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import { CreateProjectPolygonRequestDto } from "./create-project-polygon-request.dto";

export class UpdateProjectPolygonAttributesDto {
  @ApiProperty({
    description: `Array of feature collections containing the new geometry to update.
    
    - Must provide a single feature collection with the new geometry
    - The projectPitchUuid in feature properties will be ignored (the existing association is maintained)
    - The polygon geometry will be replaced with the new geometry`,
    type: CreateProjectPolygonRequestDto,
    isArray: true,
    example: [
      {
        type: "FeatureCollection",
        features: [
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
            properties: {}
          }
        ]
      }
    ]
  })
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreateProjectPolygonRequestDto)
  geometries: CreateProjectPolygonRequestDto[];
}

export class UpdateProjectPolygonDataDto extends JsonApiDataDto(
  { type: "projectPolygons" },
  UpdateProjectPolygonAttributesDto
) {}

export class UpdateProjectPolygonRequestDto extends JsonApiBodyDto(UpdateProjectPolygonDataDto) {}
