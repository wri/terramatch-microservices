import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class ProjectPolygonQueryDto {
  @ApiProperty({
    name: "projectPitchId",
    required: false,
    description: "UUID of the project pitch to get the polygon for",
    example: "550e8400-e29b-41d4-a716-446655440000"
  })
  @IsOptional()
  @IsUUID()
  projectPitchId?: string;
}
