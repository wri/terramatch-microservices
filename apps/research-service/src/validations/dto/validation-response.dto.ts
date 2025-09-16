import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString, IsBoolean, IsObject, IsOptional, ValidateNested, IsNumber, IsDate } from "class-validator";
import { Type } from "class-transformer";

export class ValidationCriteriaDto {
  @ApiProperty({
    description: "The polygon UUID that was validated (optional for historic data)",
    example: "7631be34-bbe0-4e1e-b4fe-592677dc4b50",
    type: String,
    required: false
  })
  @IsOptional()
  @IsString()
  polygonUuid?: string;

  @ApiProperty({
    description: "The validation criteria ID",
    example: 4,
    type: Number
  })
  @IsNumber()
  criteriaId: number;

  @ApiProperty({
    description: "Whether the polygon passed this validation",
    example: true,
    type: Boolean
  })
  @IsBoolean()
  valid: boolean;

  @ApiProperty({
    description: "When this validation was last run (optional for new validations)",
    example: "2025-02-20T22:01:31Z",
    type: Date,
    required: false
  })
  @IsOptional()
  @IsDate()
  createdAt?: Date;

  @ApiProperty({
    description: "Additional information about the validation result",
    example: null,
    required: false,
    type: Object
  })
  @IsOptional()
  @IsObject()
  extraInfo?: object | null;
}

export class ValidationResponseDto {
  @ApiProperty({
    description: "Array of validation results for each polygon",
    type: [ValidationCriteriaDto],
    isArray: true
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValidationCriteriaDto)
  results: ValidationCriteriaDto[];
}
