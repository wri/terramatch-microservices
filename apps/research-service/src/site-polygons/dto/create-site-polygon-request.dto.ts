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
  siteId?: string;
  polyName?: string;
  plantStart?: string;
  practice?: string;
  targetSys?: string;
  distr?: string;
  numTrees?: number;
  pointId?: string;
  site_id?: string;
  poly_name?: string;
  plantstart?: string;
  target_sys?: string;
  num_trees?: number;
  point_id?: string;
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
    description: `Array of features to create. Properties support both camelCase (primary/preferred) and snake_case (backward compatibility).
    camelCase takes precedence if both formats are present for the same property.`,
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
          siteId: "550e8400-e29b-41d4-a716-446655440000",
          polyName: "North Field",
          plantStart: "2023-01-15T00:00:00Z"
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
 * Normal Creation: Provide geometries array (required). Attributes come from feature properties.
 * Version Creation: Provide baseSitePolygonUuid + changeReason + (geometries and/or attributeChanges).
 *   - Geometry only: provide geometries (properties ignored)
 *   - Attributes only: provide attributeChanges
 *   - Both: provide both geometries and attributeChanges
 */
export class CreateSitePolygonAttributesDto {
  @ApiProperty({
    description: `Array of feature collections containing geometries to create or update.
    
    Normal Creation (required):
    - Must provide \`geometries\` array
    - Attributes come from \`properties\` within each feature
    - Each feature must have \`siteId\` (camelCase, preferred) or \`site_id\` (snake_case, backward compatibility) in properties
    
    Version Creation (optional):
    - Provide \`geometries\` to update geometry only, or together with \`attributeChanges\` to update both
    - When provided, only the geometry is used - feature properties are ignored
    - For attribute-only updates, omit this field and use \`attributeChanges\` instead
    - Must provide at least one of \`geometries\` or \`attributeChanges\` when creating a version`,
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
              siteId: "550e8400-e29b-41d4-a716-446655440000"
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
    description:
      "Reason for creating version (optional when baseSitePolygonUuid is provided, defaults to 'Version created via API')",
    required: false,
    example: "Updated polygon boundary based on field survey data"
  })
  @IsOptional()
  @IsString()
  @ValidateIf(o => o.baseSitePolygonUuid != null && o.baseSitePolygonUuid.length > 0)
  changeReason?: string;

  @ApiProperty({
    description: `Attribute changes to apply when creating a version. 
    
    Only used when \`baseSitePolygonUuid\` is provided (version creation mode).
    
    Version Creation Scenarios:
    - Attributes only: Provide \`attributeChanges\` without \`geometries\`
    - Both geometry and attributes: Provide both \`geometries\` and \`attributeChanges\`
    - Geometry only: Provide \`geometries\` without \`attributeChanges\`
    
    Important: This is the ONLY way to update attributes during version creation.
    For normal creation, attributes should be provided in feature \`properties\` within \`geometries\`.
    Geometry properties are ignored during version creation - use this field instead.
    
    Must provide at least one of \`geometries\` or \`attributeChanges\` when creating a version.`,
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
