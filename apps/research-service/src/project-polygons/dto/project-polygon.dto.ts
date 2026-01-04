import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportDto } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { ProjectPolygon } from "@terramatch-microservices/database/entities";

@JsonApiDto({ type: "projectPolygons" })
export class ProjectPolygonDto extends HybridSupportDto {
  constructor(projectPolygon?: ProjectPolygon, projectPitchUuid?: string | null) {
    super();
    if (projectPolygon != null) {
      populateDto<ProjectPolygonDto, ProjectPolygon>(this, projectPolygon, {
        lightResource: true,
        polygonUuid: projectPolygon.polyUuid,
        projectPitchUuid: projectPitchUuid ?? null
      });
    }
  }

  @ApiProperty({
    type: String,
    description: "UUID of the project polygon"
  })
  uuid: string;

  @ApiProperty({
    description: "UUID of the associated polygon geometry",
    nullable: true,
    type: String
  })
  polygonUuid: string | null;

  @ApiProperty({
    description: "UUID of the associated project pitch",
    nullable: true,
    type: String
  })
  projectPitchUuid: string | null;

  @ApiProperty({
    description: "Entity type (currently only supports ProjectPitch)",
    type: String
  })
  entityType: string;

  @ApiProperty({
    description: "Entity ID (project pitch ID)",
    type: Number
  })
  entityId: number;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "User ID who created the project polygon"
  })
  createdBy: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: "User ID who last modified the project polygon"
  })
  lastModifiedBy: number | null;

  @ApiProperty({
    nullable: true,
    type: Date,
    description: "Creation timestamp"
  })
  createdAt: Date | null;

  @ApiProperty({
    nullable: true,
    type: Date,
    description: "Last update timestamp"
  })
  updatedAt: Date | null;
}
