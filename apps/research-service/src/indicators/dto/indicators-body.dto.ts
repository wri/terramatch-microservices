import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsUUID } from "class-validator";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class IndicatorsAttributes {
  @IsArray()
  @IsUUID(4, { each: true })
  @ApiProperty({
    description: "The UUIDs of the polygons to calculate indicators for",
    example: ["123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-12d3-a456-426614174001"]
  })
  polygonUuids: string[];

  @ApiProperty({
    description: "Whether to update the existing indicators",
    example: true
  })
  @IsBoolean()
  @IsOptional()
  updateExisting: boolean | null;

  @ApiProperty({
    description: "Whether to force recalculation of the indicators",
    example: true
  })
  @IsBoolean()
  @IsOptional()
  forceRecalculation: boolean | null;
}

export class IndicatorsBodyDto extends JsonApiBodyDto(
  class IndicatorsRequestData extends CreateDataDto("indicators", IndicatorsAttributes) {}
) {}
