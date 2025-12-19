import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsString, ValidateNested, IsUUID } from "class-validator";
import { Type } from "class-transformer";
import { Feature as BaseFeature } from "@terramatch-microservices/database/constants";

export interface FeatureProperties {
  projectPitchId?: string;
  project_pitch_id?: string;
}

export interface Feature extends BaseFeature {
  type: "Feature";
  properties: FeatureProperties & Record<string, unknown>;
}

export class CreateProjectPolygonRequestDto {
  @ApiProperty({
    description: "Feature collection type (always 'FeatureCollection')",
    example: "FeatureCollection"
  })
  @IsString()
  @IsNotEmpty()
  type: "FeatureCollection";

  @ApiProperty({
    description: `Array of features to create. Each feature must have \`projectPitchId\` (camelCase, preferred) or \`project_pitch_id\` (snake_case, backward compatibility) in properties.
    Only one polygon per project pitch is supported.`,
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
          projectPitchId: "550e8400-e29b-41d4-a716-446655440000"
        }
      }
    ],
    isArray: true
  })
  @IsArray()
  @IsNotEmpty()
  features: Feature[];
}

export class CreateProjectPolygonAttributesDto {
  @ApiProperty({
    description: `Array of feature collections containing geometries to create.
    
    Each feature must have \`projectPitchId\` (camelCase, preferred) or \`project_pitch_id\` (snake_case, backward compatibility) in properties.
    Only one polygon per project pitch is supported.`,
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
            properties: {
              projectPitchId: "550e8400-e29b-41d4-a716-446655440000"
            }
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

export class CreateProjectPolygonDataDto {
  @ApiProperty({
    description: "Resource type",
    example: "projectPolygons"
  })
  @IsString()
  @IsNotEmpty()
  type: "projectPolygons";

  @ApiProperty({
    description: "Attributes containing the geometries to create",
    type: CreateProjectPolygonAttributesDto
  })
  @ValidateNested()
  @Type(() => CreateProjectPolygonAttributesDto)
  attributes: CreateProjectPolygonAttributesDto;
}

export class CreateProjectPolygonJsonApiRequestDto {
  @ApiProperty({
    description: "JSON:API data object",
    type: CreateProjectPolygonDataDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CreateProjectPolygonDataDto)
  data: CreateProjectPolygonDataDto;
}
