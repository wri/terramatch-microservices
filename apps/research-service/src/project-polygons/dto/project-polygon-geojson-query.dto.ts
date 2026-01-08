import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";

export class ProjectPolygonGeoJsonQueryDto {
  @ApiProperty({
    description: "UUID of a project pitch to get its polygon",
    required: true,
    example: "123e4567-e89b-12d3-a456-426614174001"
  })
  @IsUUID()
  projectPitchUuid: string;
}
