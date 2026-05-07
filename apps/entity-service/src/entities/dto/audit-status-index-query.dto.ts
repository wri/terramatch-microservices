import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsOptional, IsString } from "class-validator";

export class AuditStatusIndexQueryDto {
  @ApiProperty({
    required: false,
    isArray: true,
    type: String,
    description:
      "Audit `type` values to include (e.g. repeat `types` query param). When omitted, all audit rows are returned."
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value == null || value === "") {
      return undefined;
    }
    const raw = Array.isArray(value) ? value : [value];
    const trimmed = raw.map((t: unknown) => String(t).trim()).filter(t => t.length > 0);
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsArray()
  @IsString({ each: true })
  types?: string[];
}
