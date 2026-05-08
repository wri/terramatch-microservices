import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";

export class AuditStatusIndexQueryDto {
  @ApiProperty({
    required: false,
    isArray: true,
    type: String,
    description: "Filter by audit `type` values. When omitted, all audit rows are returned."
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: string[];
}
