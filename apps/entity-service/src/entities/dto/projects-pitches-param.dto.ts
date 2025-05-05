import { ApiProperty } from "@nestjs/swagger";

export class ProjectsPitchesParamDto {
  @ApiProperty({ description: "pagination page" })
  pageNumber?: number;

  @ApiProperty({ description: "pagination page" })
  pageSize?: number;

  @ApiProperty({ description: "text to search" })
  search: string;
}
