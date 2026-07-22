import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmptyObject,
  IsString,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from "class-validator";
import { DeleteDataDto, JsonApiBulkBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";
import {
  SITE_POLYGON_DISTRIBUTIONS,
  SITE_POLYGON_PRACTICES,
  SITE_POLYGON_SUBMISSION_CYCLES,
  SITE_POLYGON_TARGET_SYSTEMS
} from "@terramatch-microservices/database/constants";

export const BULK_ATTRIBUTE_CHANGE_KEYS = [
  "plantStart",
  "practice",
  "targetSys",
  "distr",
  "numTrees",
  "submissionCycle"
] as const;

@ValidatorConstraint({ name: "isBulkAttributeChanges", async: false })
export class IsBulkAttributeChangesConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    const keys = Object.keys(value);
    return keys.every(key => BULK_ATTRIBUTE_CHANGE_KEYS.includes(key as (typeof BULK_ATTRIBUTE_CHANGE_KEYS)[number]));
  }

  defaultMessage(args: ValidationArguments): string {
    const value = args.value;
    if (value == null || typeof value !== "object" || Array.isArray(value)) {
      return "attributeChanges must be an object";
    }

    const unsupportedKeys = Object.keys(value).filter(
      key => !BULK_ATTRIBUTE_CHANGE_KEYS.includes(key as (typeof BULK_ATTRIBUTE_CHANGE_KEYS)[number])
    );
    return `Unsupported attributeChanges field(s): ${unsupportedKeys.join(", ")}`;
  }
}

export class SitePolygonBulkAttributeChangesDto {
  @ApiProperty({
    description: "Planting start date (ISO 8601). Empty string clears the field.",
    required: false,
    example: "2023-01-15T00:00:00Z"
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @IsDateString()
  plantStart?: string;

  @ApiProperty({
    description: "Restoration practice slug(s). Empty array clears the field.",
    required: false,
    example: ["tree-planting"],
    type: [String]
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @IsIn(SITE_POLYGON_PRACTICES, { each: true })
  practice?: string[];

  @ApiProperty({
    description: "Target land use system slug. Empty string clears the field.",
    required: false,
    example: "natural-forest"
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @IsIn(SITE_POLYGON_TARGET_SYSTEMS)
  targetSys?: string;

  @ApiProperty({
    description: "Tree distribution slug(s). Empty array clears the field.",
    required: false,
    example: ["full"],
    type: [String]
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @IsIn(SITE_POLYGON_DISTRIBUTIONS, { each: true })
  distr?: string[];

  @ApiProperty({
    description: "Submission cycle slug. Empty string clears the field.",
    required: false,
    example: "1"
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @ValidateIf((_, value) => value !== "")
  @IsIn(SITE_POLYGON_SUBMISSION_CYCLES)
  submissionCycle?: string;

  @ApiProperty({
    description: "Number of trees planted",
    required: false,
    example: 150
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  numTrees?: number;
}

export class SitePolygonBulkAttributeUpdateBodyDto extends JsonApiBulkBodyDto(
  class SitePolygonBulkAttributeUpdateData extends DeleteDataDto({ type: "sitePolygons", id: "uuid" }) {},
  {
    minSize: 1,
    minSizeMessage: "At least one site polygon must be provided",
    description: "Array of site polygon resource identifiers to update",
    example: [
      { type: "sitePolygons", id: "123e4567-e89b-12d3-a456-426614174000" },
      { type: "sitePolygons", id: "123e4567-e89b-12d3-a456-426614174001" }
    ]
  }
) {
  @IsNotEmptyObject({}, { message: "attributeChanges must contain at least one field to update" })
  @Validate(IsBulkAttributeChangesConstraint)
  @ValidateNested()
  @Type(() => SitePolygonBulkAttributeChangesDto)
  @ApiProperty({
    description:
      "Attribute values applied to every site polygon in data. At least one field must be provided. " +
      "Omitted fields are inherited from each polygon's active version.",
    type: SitePolygonBulkAttributeChangesDto
  })
  attributeChanges: SitePolygonBulkAttributeChangesDto;
}
