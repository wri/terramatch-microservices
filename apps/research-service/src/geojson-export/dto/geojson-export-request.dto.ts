import { ApiProperty } from "@nestjs/swagger";
import { ArrayMinSize, IsArray, IsOptional, IsUUID } from "class-validator";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class GeoJsonExportAttributes {
  @ApiProperty({
    isArray: true,
    type: String,
    required: false,
    description: "Export all active polygons in these projects."
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  projectUuids?: string[];

  @ApiProperty({
    isArray: true,
    type: String,
    required: false,
    description: "Export all active polygons in these sites."
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  siteUuids?: string[];

  @ApiProperty({
    isArray: true,
    type: String,
    required: false,
    description: "Export these active polygons (polygon geometry UUIDs, as used by geojson?uuid=)."
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID(undefined, { each: true })
  polygonUuids?: string[];
}

export class GeoJsonExportBodyDto extends JsonApiBodyDto(
  class GeoJsonExportData extends CreateDataDto("geojsonExports", GeoJsonExportAttributes) {}
) {}
