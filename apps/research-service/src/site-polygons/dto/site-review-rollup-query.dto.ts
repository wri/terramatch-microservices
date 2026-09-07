import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class SiteReviewRollupQueryDto {
  @ApiProperty({
    description: "UUID of the project to roll the review status up for. One row is returned per site.",
    example: "cd46fa33-a5c1-40b4-a9ca-4793b6248157"
  })
  @IsUUID()
  projectId: string;
}
