import { ApiProperty } from "@nestjs/swagger";

export class ProjectsPitchesParamDto {
  @ApiProperty({ description: "pagination page" })
  perPage?: number;

  @ApiProperty({ description: "uuids array to search" })
  search: string[];
}
