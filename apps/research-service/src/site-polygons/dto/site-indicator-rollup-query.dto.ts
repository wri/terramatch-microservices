import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class SiteIndicatorRollupQueryDto {
  @ApiProperty({
    description: "UUID of the project to roll indicators up for. One row is returned per approved site.",
    example: "cd46fa33-a5c1-40b4-a9ca-4793b6248157"
  })
  @IsUUID()
  projectId: string;
}
