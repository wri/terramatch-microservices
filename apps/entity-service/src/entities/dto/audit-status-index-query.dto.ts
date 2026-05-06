import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";

export class AuditStatusIndexQueryDto {
  @ApiProperty({
    required: false,
    description:
      "Comma-separated list of audit `type` values to include (e.g. polygon-data-submission,ready-for-baseline). When omitted, all audit rows are returned."
  })
  @IsOptional()
  @IsString()
  types?: string;
}
