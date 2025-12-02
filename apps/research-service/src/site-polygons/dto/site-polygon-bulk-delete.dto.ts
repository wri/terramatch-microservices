import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsUUID, ArrayMinSize } from "class-validator";

export class SitePolygonBulkDeleteBodyDto {
  @IsArray()
  @ArrayMinSize(1, { message: "At least one UUID must be provided" })
  @IsUUID(undefined, { each: true, message: "Each UUID must be a valid UUID format" })
  @ApiProperty({
    description: "Array of site polygon UUIDs to delete",
    type: [String],
    example: ["123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-12d3-a456-426614174001"],
    minItems: 1
  })
  uuids: string[];
}
