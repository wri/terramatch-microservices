import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsString, ArrayMinSize, IsIn, IsOptional } from "class-validator";
import { VALIDATION_TYPES, ValidationType } from "@terramatch-microservices/database/constants";

export class ValidationRequestDto {
  @ApiProperty({
    description: "Array of polygon UUIDs to validate",
    example: ["7631be34-bbe0-4e1e-b4fe-592677dc4b50", "d6502d4c-dfd6-461e-af62-21a0ec2f3e65"],
    type: [String],
    isArray: true
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  polygonUuids: string[];

  @ApiProperty({
    enum: VALIDATION_TYPES,
    name: "validationTypes[]",
    isArray: true,
    required: false,
    description: "Array of validation types to run. If not provided, all validation types will be run."
  })
  @IsOptional()
  @IsArray()
  @IsIn(VALIDATION_TYPES, { each: true })
  validationTypes?: ValidationType[];
}
