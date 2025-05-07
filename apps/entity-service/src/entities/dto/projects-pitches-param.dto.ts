import { ApiProperty } from "@nestjs/swagger";

export class ProjectsPitchesParamDto {
  // TODO delete
  @ApiProperty({ description: "pagination page" })
  pageNumber?: number;

  @ApiProperty({ description: "pagination page" })
  pageSize?: number;

  @ApiProperty({ description: "text to search" })
  search: string;
}
