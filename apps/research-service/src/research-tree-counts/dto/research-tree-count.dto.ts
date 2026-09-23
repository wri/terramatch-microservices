import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Project, ResearchTreeCount } from "@terramatch-microservices/database/entities";
import {
  VERIFICATION_METHODS,
  VerificationMethod
} from "@terramatch-microservices/database/constants/reseach-tree-count";

export type ResearchTreeCountWithProject = ResearchTreeCount & { project: Pick<Project, "uuid"> };

@JsonApiDto({ type: "researchTreeCounts" })
export class ResearchTreeCountDto {
  constructor(treeCount: ResearchTreeCountWithProject) {
    populateDto<ResearchTreeCountDto, ResearchTreeCount>(this, treeCount, {
      projectUuid: treeCount.project.uuid
    });
  }

  @ApiProperty({ description: "The UUID of the project this tree count belongs to" })
  projectUuid: string;

  @ApiProperty({ enum: VERIFICATION_METHODS })
  verificationMethod: VerificationMethod;

  @ApiProperty()
  reportedCount: number;

  @ApiProperty()
  treeCountAdj: number;

  @ApiProperty()
  upperBounds: number;

  @ApiProperty()
  lowerBounds: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
