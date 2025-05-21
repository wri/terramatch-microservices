import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { IsArray, IsNumber } from "class-validator";

/**
 * DTO for bounding box data
 * Format: [minLng, minLat, maxLng, maxLat]
 */
@JsonApiDto({ type: "boundingBoxes" })
export class BoundingBoxDto {
  constructor(data?: { bbox: number[] }) {
    if (data !== undefined && data !== null) {
      populateDto(this, data);
    }
  }

  @ApiProperty({
    description: "The bounding box coordinates in [minLng, minLat, maxLng, maxLat] format",
    type: [Number],
    example: [-13.17273163, -21.3169788, 48.8126753, 13.47775425]
  })
  @IsArray()
  @IsNumber({}, { each: true })
  bbox: number[];
}
