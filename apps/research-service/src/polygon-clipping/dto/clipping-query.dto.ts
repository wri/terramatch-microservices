import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class ClippingQueryDto {
  @ApiProperty({
    required: false,
    description: "Site UUID to clip polygons for all polygons in the site",
    format: "uuid"
  })
  @IsOptional()
  @IsUUID()
  siteUuid?: string;

  @ApiProperty({
    required: false,
    description: "Project UUID to clip polygons for all polygons in the project",
    format: "uuid"
  })
  @IsOptional()
  @IsUUID()
  projectUuid?: string;
}
