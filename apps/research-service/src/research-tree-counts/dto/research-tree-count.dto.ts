import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsUUID } from "class-validator";
import {
  CreateDataDto,
  JsonApiBodyDto,
  JsonApiDataDto
} from "@terramatch-microservices/common/util/json-api-update-dto";
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

export class UpdateResearchTreeCountAttributes {
  @IsOptional()
  @IsIn(VERIFICATION_METHODS)
  @ApiProperty({ enum: VERIFICATION_METHODS, required: false })
  verificationMethod?: VerificationMethod;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false })
  reportedCount?: number;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false })
  treeCountAdj?: number;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false })
  upperBounds?: number;

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false })
  lowerBounds?: number;
}

export class CreateResearchTreeCountAttributes {
  @IsUUID()
  @ApiProperty({ description: "The UUID of the project this tree count belongs to", format: "uuid" })
  projectUuid: string;

  @IsIn(VERIFICATION_METHODS)
  @ApiProperty({ enum: VERIFICATION_METHODS })
  verificationMethod: VerificationMethod;

  @IsInt()
  @ApiProperty()
  reportedCount: number;

  @IsInt()
  @ApiProperty()
  treeCountAdj: number;

  @IsInt()
  @ApiProperty()
  upperBounds: number;

  @IsInt()
  @ApiProperty()
  lowerBounds: number;
}

export class CreateResearchTreeCountBody extends JsonApiBodyDto(
  class CreateResearchTreeCountData extends CreateDataDto("researchTreeCounts", CreateResearchTreeCountAttributes) {}
) {}

export class UpdateResearchTreeCountBody extends JsonApiBodyDto(
  class UpdateResearchTreeCountData extends JsonApiDataDto(
    { type: "researchTreeCounts" },
    UpdateResearchTreeCountAttributes
  ) {}
) {}
