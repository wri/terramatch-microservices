import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsUUID } from "class-validator";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export class GeoJsonQueryDto {
  @ApiProperty({
    description: "UUID of a specific polygon",
    required: false,
    example: "123e4567-e89b-12d3-a456-426614174000"
  })
  @IsOptional()
  @IsUUID()
  uuid?: string;

  @ApiProperty({
    description: "UUID of a site to get all its polygons",
    required: false,
    example: "123e4567-e89b-12d3-a456-426614174001"
  })
  @IsOptional()
  @IsUUID()
  siteUuid?: string;

  @ApiProperty({
    description: "Include extended data from site_polygon_data table",
    required: false,
    default: true
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  includeExtendedData?: boolean = true;

  @ApiProperty({
    description: "Return only geometry without properties",
    required: false,
    default: false
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  geometryOnly?: boolean = false;
}
