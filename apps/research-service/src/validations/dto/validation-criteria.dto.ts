import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsDate, IsNumber, IsOptional, IsObject } from "class-validator";

export class ValidationCriteriaDto {
  @ApiProperty({
    description: "The criteria ID that was validated",
    example: 3,
    type: Number
  })
  @IsNumber()
  criteriaId: number;

  @ApiProperty({
    description: "Whether the polygon passed this validation criteria",
    example: true,
    type: Boolean
  })
  @IsBoolean()
  valid: boolean;

  @ApiProperty({
    description: "When this validation was last run",
    example: "2025-02-20T22:01:31Z",
    type: Date
  })
  @IsDate()
  createdAt: Date;

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
