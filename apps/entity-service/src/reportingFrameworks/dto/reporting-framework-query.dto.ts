import { IsOptional } from "class-validator";
import { Transform } from "class-transformer";
import { ApiProperty } from "@nestjs/swagger";

export class ReportingFrameworkQueryDto {
  @IsOptional()
  @Transform(({ value }) => value === "false" || value === false)
  @ApiProperty({
    required: false,
    description: "Whether to return translated content. Defaults to true.",
    type: Boolean
  })
  translated?: boolean;
}
