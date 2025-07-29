import { ApiProperty } from "@nestjs/swagger";

// TODO: Update this response structure based on GH (Greenhouse) documentation
// Current structure matches PHP V2 for backward compatibility testing
export class GeometryResponseDto {
  @ApiProperty({
    description: "Site identifier",
    example: "site-123"
  })
  site_id: string;

  @ApiProperty({
    description: "Geometry type processed",
    example: "Point"
  })
  geometry_type: string;

  @ApiProperty({
    description: "Array of created polygon UUIDs",
    example: ["uuid-1", "uuid-2"],
    type: [String]
  })
  polygon_uuids: string[];

  @ApiProperty({
    description: "Validation errors (empty object if no errors)",
    example: {}
  })
  errors: Record<string, unknown>;
}
