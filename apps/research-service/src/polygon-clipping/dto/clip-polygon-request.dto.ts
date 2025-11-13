import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID } from "class-validator";
import { CreateDataDto, JsonApiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class PolygonListClippingAttributes {
  @ApiProperty({
    description: "Array of polygon UUIDs to check and clip for fixable overlaps",
    example: ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"],
    type: [String]
  })
  @IsArray()
  @IsUUID(4, { each: true })
  polygonUuids: string[];
}

export class PolygonListClippingRequestBody extends JsonApiBodyDto(
  class PolygonListClippingData extends CreateDataDto("polygon-clipping", PolygonListClippingAttributes) {}
) {}
