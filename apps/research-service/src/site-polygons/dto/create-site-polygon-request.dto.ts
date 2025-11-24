import { ApiProperty } from "@nestjs/swagger";
import {
  IsArray,
  IsNotEmpty,
  IsString,
  ValidateNested,
  IsOptional,
  IsUUID,
  IsNumber,
  ValidateIf
} from "class-validator";
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

export class AttributeChangesDto {
  @ApiProperty({
    description: "Updated polygon name",
    required: false,
    example: "North Field Updated"
  })
  @IsOptional()
  @IsString()
  polyName?: string;

  @ApiProperty({
    description: "Updated planting start date (ISO 8601 format)",
    required: false,
    example: "2023-01-15T00:00:00Z"
  })
  @IsOptional()
  @IsString()
  plantStart?: string;

  @ApiProperty({
    description: "Updated practice type(s) as array of strings",
    required: false,
    example: ["tree-planting"],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  practice?: string[];

  @ApiProperty({
    description: "Updated target system",
    required: false,
    example: "restoration"
  })
  @IsOptional()
  @IsString()
  targetSys?: string;

  @ApiProperty({
    description: "Updated distribution method(s) as array of strings",
    required: false,
    example: ["full", "single-line"],
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  distr?: string[];

  @ApiProperty({
    description: "Updated number of trees",
    required: false,
    example: 150
  })
  @IsOptional()
  @IsNumber()
  numTrees?: number;
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

/**
 * Extended attributes DTO supporting both normal creation and version creation.
 *
 * Normal Creation: Provide geometries array
 * Version Creation: Provide baseSitePolygonUuid + (geometries and/or attributeChanges)
 */
export class CreateSitePolygonAttributesDto {
  @ApiProperty({
    description: "Array of feature collections (optional when creating version with attribute-only changes)",
    type: CreateSitePolygonRequestDto,
    isArray: true,
    required: false,
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
              site_id: "550e8400-e29b-41d4-a716-446655440000"
            }
          }
        ]
      }
    ]
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSitePolygonRequestDto)
  geometries?: CreateSitePolygonRequestDto[];

  @ApiProperty({
    description:
      "UUID of existing site polygon to create version from. When provided, creates a new version instead of a new polygon.",
    required: false,
    example: "550e8400-e29b-41d4-a716-446655440000"
  })
  @IsOptional()
  @IsUUID()
  baseSitePolygonUuid?: string;

  @ApiProperty({
    description: "Reason for creating version (required when baseSitePolygonUuid is provided)",
    required: false,
    example: "Updated polygon boundary based on field survey data"
  })
  @IsOptional()
  @IsString()
  @ValidateIf(o => o.baseSitePolygonUuid != null && o.baseSitePolygonUuid.length > 0)
  @IsNotEmpty({ message: "changeReason is required when creating a version (baseSitePolygonUuid provided)" })
  changeReason?: string;

  @ApiProperty({
    description: "Attribute changes to apply when creating version (optional, for attribute-only or mixed updates)",
    required: false,
    type: AttributeChangesDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => AttributeChangesDto)
  attributeChanges?: AttributeChangesDto;
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
