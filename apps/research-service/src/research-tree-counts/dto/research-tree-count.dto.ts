import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsInt, IsOptional, IsUUID, ValidateIf } from "class-validator";
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
} from "@terramatch-microservices/database/constants/research-tree-count";

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

  @ApiProperty({ nullable: true, type: Number })
  treeCountAdj: number | null;

  @ApiProperty()
  upperBounds: number;

  @ApiProperty()
  lowerBounds: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// Unlike @IsOptional(), this still validates null, so the non-nullable fields reject it.
const isProvided = (_: object, value: unknown) => value !== undefined;

export class UpdateResearchTreeCountAttributes {
  @ValidateIf(isProvided)
  @IsIn(VERIFICATION_METHODS)
  @ApiProperty({ enum: VERIFICATION_METHODS, required: false })
  verificationMethod?: VerificationMethod;

  @ValidateIf(isProvided)
  @IsInt()
  @ApiProperty({ required: false })
  reportedCount?: number;

  // @IsOptional() also lets null through, which clears the value.
  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false, nullable: true, type: Number, description: "Send null to clear the value" })
  treeCountAdj?: number | null;

  @ValidateIf(isProvided)
  @IsInt()
  @ApiProperty({ required: false })
  upperBounds?: number;

  @ValidateIf(isProvided)
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

  @IsOptional()
  @IsInt()
  @ApiProperty({ required: false })
  treeCountAdj?: number;

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
