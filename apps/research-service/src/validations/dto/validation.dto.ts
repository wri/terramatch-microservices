import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ValidationCriteriaDto } from "./validation-criteria.dto";

@JsonApiDto({ type: "validations" })
export class ValidationDto {
  @ApiProperty({
    description: "The UUID of the polygon that was validated",
    example: "d6502d4c-dfd6-461e-af62-21a0ec2f3e65"
  })
  polygonUuid: string;

  @ApiProperty({
    description: "List of validation criteria results for this polygon",
    type: ValidationCriteriaDto,
    isArray: true,
    example: [
      {
        criteriaId: 16,
        validationType: "DUPLICATE_GEOMETRY",
        valid: false,
        createdAt: "2025-11-28T20:41:50.060Z",
        extraInfo: {
          polygonUuid: "54aa2c7a-e139-4017-b86b-d904f4a3ed5c",
          message: "This geometry already exists in the project",
          sitePolygonUuid: "fd6cd4e8-0c56-45dc-8991-1cebfd3871ca",
          sitePolygonName: "AREA_NAME"
        }
      }
    ]
  })
  criteriaList: ValidationCriteriaDto[];
}
