import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsArray, IsUUID, ValidateNested, ArrayMinSize } from "class-validator";
import { Type } from "class-transformer";

class SitePolygonDeleteResource {
  @Equals("sitePolygons")
  @ApiProperty({ enum: ["sitePolygons"], example: "sitePolygons" })
  type: string;

  @IsUUID()
  @ApiProperty({ format: "uuid", description: "UUID of the site polygon to delete" })
  id: string;
}

export class SitePolygonBulkDeleteBodyDto {
  @IsArray()
  @ArrayMinSize(1, { message: "At least one site polygon must be provided" })
  @ValidateNested({ each: true })
  @Type(() => SitePolygonDeleteResource)
  @ApiProperty({
    description: "Array of site polygon resource identifiers to delete",
    type: [SitePolygonDeleteResource],
    example: [
      { type: "sitePolygons", id: "123e4567-e89b-12d3-a456-426614174000" },
      { type: "sitePolygons", id: "123e4567-e89b-12d3-a456-426614174001" }
    ]
  })
  data: SitePolygonDeleteResource[];
}
