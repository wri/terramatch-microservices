import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";

@JsonApiDto({ type: "clippedVersions" })
export class ClippedVersionDto {
  @ApiProperty({
    description: "The UUID of the newly created polygon version",
    example: "550e8400-e29b-41d4-a716-446655440000"
  })
  uuid: string;

  @ApiProperty({
    description: "The name of the polygon",
    example: "Plot_1_2024"
  })
  polyName: string | null;

  @ApiProperty({
    description: "The original area in hectares before clipping",
    example: 2.5
  })
  originalArea: number;

  @ApiProperty({
    description: "The new area in hectares after clipping",
    example: 2.35
  })
  newArea: number;

  @ApiProperty({
    description: "The area removed in hectares",
    example: 0.15
  })
  areaRemoved: number;
}
