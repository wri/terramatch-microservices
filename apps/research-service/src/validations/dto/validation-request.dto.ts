import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, ArrayMinSize } from "class-validator";

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
    description: "Optional array of validation types to run",
    example: ["SELF_INTERSECTION", "SPIKES"],
    type: [String],
    isArray: true,
    required: false
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  validationTypes?: string[];
}
