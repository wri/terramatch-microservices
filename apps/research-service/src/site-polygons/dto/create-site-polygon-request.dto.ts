import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsNotEmpty, IsString, ValidateNested, ArrayMinSize } from "class-validator";
import { Type } from "class-transformer";
import { Feature as BaseFeature } from "@terramatch-microservices/database/constants";

export interface FeatureProperties {
  site_id: string;
  poly_name?: string;
  plantstart?: string;
  practice?: string;
  target_sys?: string;
  distr?: string;
  num_trees?: number;
}

export interface Feature extends BaseFeature {
  type: "Feature";
  properties: FeatureProperties & Record<string, unknown>;
}

export class CreateSitePolygonRequestDto {
  @ApiProperty({
    description: "Feature collection type (always 'FeatureCollection')",
    example: "FeatureCollection"
  })
  @IsString()
  @IsNotEmpty()
  type: "FeatureCollection";

  @ApiProperty({
    description: "Array of features to create",
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
          site_id: "550e8400-e29b-41d4-a716-446655440000",
          poly_name: "North Field",
          plantstart: "2023-01-15T00:00:00Z"
        }
      }
    ],
    isArray: true
  })
  @IsArray()
  @IsNotEmpty()
  features: Feature[];
}

export class CreateSitePolygonBatchRequestDto {
  @ApiProperty({
    description: "Array of feature collections (supports multi-site batch creation)",
    type: CreateSitePolygonRequestDto,
    isArray: true
  })
  @IsArray()
  geometries: CreateSitePolygonRequestDto[];
}

export class CreateSitePolygonAttributesDto {
  @ApiProperty({
    description: "Array of feature collections (supports multi-site batch creation)",
    type: CreateSitePolygonRequestDto,
    isArray: true
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSitePolygonRequestDto)
  geometries: CreateSitePolygonRequestDto[];
}

export class CreateSitePolygonDataDto {
  @ApiProperty({
    description: "Resource type",
    example: "sitePolygons"
  })
  @IsString()
  @IsNotEmpty()
  type: "sitePolygons";

  @ApiProperty({
    description: "Attributes containing the geometries to create",
    type: CreateSitePolygonAttributesDto
  })
  @ValidateNested()
  @Type(() => CreateSitePolygonAttributesDto)
  attributes: CreateSitePolygonAttributesDto;
}

export class CreateSitePolygonJsonApiRequestDto {
  @ApiProperty({
    description: "JSON:API data object",
    type: CreateSitePolygonDataDto
  })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => CreateSitePolygonDataDto)
  data: CreateSitePolygonDataDto;
}
