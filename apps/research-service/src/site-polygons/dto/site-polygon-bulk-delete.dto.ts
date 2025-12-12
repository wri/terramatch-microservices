import { ApiProperty } from "@nestjs/swagger";
import { IsArray, ValidateNested, ArrayMinSize } from "class-validator";
import { Type } from "class-transformer";
import { DeleteDataDto } from "@terramatch-microservices/common/util/json-api-update-dto";

class SitePolygonDeleteData extends DeleteDataDto({ type: "sitePolygons", id: "uuid" }) {}

export class SitePolygonBulkDeleteBodyDto {
  @IsArray()
  @ArrayMinSize(1, { message: "At least one site polygon must be provided" })
  @ValidateNested({ each: true })
  @Type(() => SitePolygonDeleteData)
  @ApiProperty({
    description: "Array of site polygon resource identifiers to delete",
    type: [SitePolygonDeleteData],
    example: [
      { type: "sitePolygons", id: "123e4567-e89b-12d3-a456-426614174000" },
      { type: "sitePolygons", id: "123e4567-e89b-12d3-a456-426614174001" }
    ]
  })
  data: SitePolygonDeleteData[];
}
