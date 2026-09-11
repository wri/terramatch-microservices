import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { JsonApiConstants } from "@terramatch-microservices/common/decorators/json-api-constants.decorator";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import {
  CreateDataDto,
  JsonApiBodyDto,
  JsonApiDataDto
} from "@terramatch-microservices/common/util/json-api-update-dto";
import { FRAMEWORK_KEYS, FrameworkKey } from "@terramatch-microservices/database/constants";
import {
  POLYGON_ATTRIBUTE_INPUT_TYPES,
  PolygonAttributeDefinition,
  PolygonAttributeInputType
} from "@terramatch-microservices/database/entities/polygon-attribute-definition.entity";
import { Transform, Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested
} from "class-validator";

@JsonApiConstants
export class PolygonAttributeDefinitionConstants {
  @ApiProperty({ example: POLYGON_ATTRIBUTE_INPUT_TYPES })
  INPUT_TYPES: string[];
}

export class PolygonAttributeDefinitionOptionDto {
  @ApiProperty({ format: "uuid" })
  uuid: string;

  @ApiProperty({ description: "Stable stored value. Generated from the option label and locked after create." })
  value: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ description: "Display order. Array index on write; persisted as order." })
  order: number;
}

type DefinitionWithoutExtras = Omit<PolygonAttributeDefinition, "options" | "framework">;

@JsonApiDto({ type: "polygonAttributeDefinitions" })
export class PolygonAttributeDefinitionDto {
  constructor(
    definition: DefinitionWithoutExtras,
    additional: AdditionalProps<PolygonAttributeDefinitionDto, DefinitionWithoutExtras>
  ) {
    populateDto<PolygonAttributeDefinitionDto, DefinitionWithoutExtras>(this, definition, additional);
  }

  @ApiProperty({ format: "uuid" })
  uuid: string;

  @ApiProperty({
    description: "Stable identifier generated from the label on create. Used as the GeoJSON property and API map key."
  })
  key: string;

  @ApiProperty()
  label: string;

  @ApiProperty({ enum: POLYGON_ATTRIBUTE_INPUT_TYPES })
  inputType: PolygonAttributeInputType;

  @ApiProperty({ enum: FRAMEWORK_KEYS })
  frameworkKey: FrameworkKey;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty({ description: "Display order within the framework." })
  order: number;

  @ApiProperty({
    description: "True when at least one polygon has a stored value for this definition. Hard-delete is then forbidden."
  })
  hasValues: boolean;

  @ApiProperty({ type: PolygonAttributeDefinitionOptionDto, isArray: true })
  options: PolygonAttributeDefinitionOptionDto[];
}

const trimString = ({ value }: { value: unknown }) => (typeof value === "string" ? value.trim() : value);

export class StorePolygonAttributeDefinitionOptionAttributes {
  @IsOptional()
  @IsUUID()
  @ApiPropertyOptional({
    format: "uuid",
    description: "Existing option uuid. Omit to create a new option. Value is locked once created."
  })
  uuid?: string;

  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: "Option display label. On create, the stored value is camelCased from this label." })
  label: string;
}

export class CreatePolygonAttributeDefinitionAttributes {
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @ApiProperty()
  label: string;

  @IsIn(POLYGON_ATTRIBUTE_INPUT_TYPES)
  @ApiProperty({ enum: POLYGON_ATTRIBUTE_INPUT_TYPES })
  inputType: PolygonAttributeInputType;

  @IsIn(FRAMEWORK_KEYS)
  @ApiProperty({ enum: FRAMEWORK_KEYS })
  frameworkKey: FrameworkKey;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ default: true })
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: "Display order within the framework. Defaults to 0." })
  order?: number;

  @IsArray()
  @ArrayMinSize(1, { message: "At least one option is required" })
  @ValidateNested({ each: true })
  @Type(() => StorePolygonAttributeDefinitionOptionAttributes)
  @ApiProperty({ type: StorePolygonAttributeDefinitionOptionAttributes, isArray: true })
  options: StorePolygonAttributeDefinitionOptionAttributes[];
}

export class UpdatePolygonAttributeDefinitionAttributes {
  @IsOptional()
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @ApiPropertyOptional()
  label?: string;

  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @ApiPropertyOptional({ description: "Display order within the framework." })
  order?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: "At least one option is required" })
  @ValidateNested({ each: true })
  @Type(() => StorePolygonAttributeDefinitionOptionAttributes)
  @ApiPropertyOptional({
    type: StorePolygonAttributeDefinitionOptionAttributes,
    isArray: true,
    description:
      "When provided, replaces the full option list. Omitted options are removed only if no polygon stores that option value. Existing option values stay locked."
  })
  options?: StorePolygonAttributeDefinitionOptionAttributes[];
}

export class CreatePolygonAttributeDefinitionBody extends JsonApiBodyDto(
  class CreatePolygonAttributeDefinitionData extends CreateDataDto(
    "polygonAttributeDefinitions",
    CreatePolygonAttributeDefinitionAttributes
  ) {}
) {}

export class UpdatePolygonAttributeDefinitionBody extends JsonApiBodyDto(
  class UpdatePolygonAttributeDefinitionData extends JsonApiDataDto(
    { type: "polygonAttributeDefinitions" },
    UpdatePolygonAttributeDefinitionAttributes
  ) {}
) {}
