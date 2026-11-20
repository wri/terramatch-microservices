import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";
import { SitePolygonProjectFiltersDto } from "../../site-polygons/dto/site-polygon-project-filters.dto";

export class ProjectFilterOptionsQueryDto extends SitePolygonProjectFiltersDto {
  @ApiProperty({
    name: "projectUuid[]",
    isArray: true,
    required: false,
    description: "Filter results by selected project UUID(s)"
  })
  @IsOptional()
  @IsArray()
  projectUuid?: string[];

  @ApiProperty({
    required: false,
    description: "Case-insensitive partial match on organisation name. Narrows only the organisation options."
  })
  @IsOptional()
  @IsString()
  organisationSearch?: string;

  @ApiProperty({
    required: false,
    description: "Case-insensitive partial match on project name. Narrows only the project options."
  })
  @IsOptional()
  @IsString()
  projectSearch?: string;
}
