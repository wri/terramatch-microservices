import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { AssociationDto, AssociationDtoAdditionalProps } from "./association.dto";
import { ProjectPitch } from "@terramatch-microservices/database/entities";

@JsonApiDto({ type: "projectPitches" })
export class ProjectPitchDto extends AssociationDto<ProjectPitchDto> {
  constructor(projectPitch: ProjectPitch, additional: AssociationDtoAdditionalProps) {
    super({
      ...pickApiProperties(projectPitch, ProjectPitchDto),
      ...additional
    });
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true })
  capacityBuildingNeeds: string[] | null;

  @ApiProperty({ nullable: true })
  totalTrees: number | null;

  @ApiProperty({ nullable: true })
  totalHectares: number | null;
}
