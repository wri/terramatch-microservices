import { ApiProperty } from "@nestjs/swagger";
import { Equals, IsOptional, IsString, IsUUID } from "class-validator";
import { JsonApiBulkBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class SitePolygonStatusUpdate {
  @Equals("sitePolygons")
  @ApiProperty({ enum: ["sitePolygons"] })
  type: string;

  @IsUUID()
  @ApiProperty({ format: "uuid" })
  id: string;
}

export class SitePolygonStatusBulkUpdateBodyDto extends JsonApiBulkBodyDto(SitePolygonStatusUpdate, {
  description: "Array of site polygons to update",
  minSize: 1,
  minSizeMessage: "At least one site polygon must be provided",
  example: [{ id: "123e4567-e89b-12d3-a456-426614174000" }, { id: "123e4567-e89b-12d3-a456-426614174001" }]
}) {
  @IsOptional()
  @IsString()
  @ApiProperty({ description: "Comment for the status update", required: false, type: String })
  comment: string | null = null;
}
