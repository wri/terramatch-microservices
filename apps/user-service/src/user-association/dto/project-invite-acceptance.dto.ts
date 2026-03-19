import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ProjectInvite } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@JsonApiDto({ type: "projectInviteAcceptances" })
export class ProjectInviteAcceptanceDto {
  constructor(invite: ProjectInvite, projectName?: string | null) {
    populateDto<ProjectInviteAcceptanceDto, ProjectInvite>(this, invite, {});
    if (projectName != null) {
      this.projectName = projectName;
    }
  }

  @ApiProperty({ description: "Primary key of the project invite." })
  id: number;

  @ApiProperty({ description: "UUID of the project invite." })
  uuid: string;

  @ApiProperty({ description: "ID of the project this invite belongs to." })
  projectId: number;

  @ApiProperty({ description: "Email address this invite was sent to." })
  emailAddress: string;

  @ApiProperty({ description: "Timestamp when the invite was accepted.", nullable: true, type: String })
  acceptedAt: Date | null;

  @ApiProperty({ description: "Name of the project.", nullable: true, type: String })
  projectName?: string | null;
}
