import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";
import { TransformBooleanString } from "@terramatch-microservices/common/decorators/transform-boolean-string.decorator";

export class GeometryQueryDto {
  @ApiProperty({
    description: "Extract properties from GeoJSON features (default: true)",
    default: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  extract_properties?: boolean = true;

  @ApiProperty({
    description: "Validate data immediately upon submission (default: true)",
    default: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  validate?: boolean = true;

  @ApiProperty({
    description: "Preserve existing status during processing (default: true)",
    default: true,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  @TransformBooleanString()
  preserve_status?: boolean = true;
}
