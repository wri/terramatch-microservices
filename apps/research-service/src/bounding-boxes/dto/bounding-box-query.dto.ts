import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString, IsUUID } from "class-validator";

export class BoundingBoxQueryDto {
  @ApiPropertyOptional({
    description: "UUID of a polygon to get its bounding box",
    type: String
  })
  @IsOptional()
  @IsUUID()
  polygonUuid?: string;

  @ApiPropertyOptional({
    description: "UUID of a site to get the bounding box of all its polygons",
    type: String
  })
  @IsOptional()
  @IsUUID()
  siteUuid?: string;

  @ApiPropertyOptional({
    description: "UUID of a project to get the bounding box of all its site polygons",
    type: String
  })
  @IsOptional()
  @IsUUID()
  projectUuid?: string;

  @ApiPropertyOptional({
    description: "UUID of a project pitch to get the bounding box of all its polygons",
    type: String
  })
  @IsOptional()
  @IsUUID()
  projectPitchUuid?: string;

  @ApiPropertyOptional({
    description: "Array of landscape slugs for combined bounding box (used with country)",
    type: [String]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  landscapes?: string[];

  @ApiPropertyOptional({
    description: "Country code (3-letter ISO) to get its bounding box",
    type: String
  })
  @IsOptional()
  @IsString()
  country?: string;
}
