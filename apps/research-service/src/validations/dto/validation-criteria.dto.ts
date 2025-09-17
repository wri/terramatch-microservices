import { ApiProperty } from "@nestjs/swagger";

export class ValidationCriteriaDto {
  @ApiProperty({
    description: "The criteria ID that was validated",
    example: 3
  })
  criteriaId: number;

  @ApiProperty({
    description: "Whether the polygon passed this validation criteria",
    example: true
  })
  valid: boolean;

  @ApiProperty({
    description: "When this validation was last run",
    example: "2025-02-20T22:01:31Z"
  })
  createdAt: Date;

  @ApiProperty({
    description: "Additional information about the validation result",
    example: null,
    required: false,
    type: Object
  })
  extraInfo?: object | null;
}
