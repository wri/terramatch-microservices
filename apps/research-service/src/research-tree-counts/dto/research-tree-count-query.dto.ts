import { ApiProperty, IntersectionType } from "@nestjs/swagger";
import { IsArray, IsDate, IsEnum, IsOptional, IsUUID, ValidateNested } from "class-validator";
import { CursorPage } from "@terramatch-microservices/common/dto/page.dto";
import { LandscapeGeometry } from "@terramatch-microservices/database/entities";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";

export class ResearchTreeCountQueryDto extends IntersectionType(CursorPage) {
  @ValidateNested()
  @IsOptional()
  page?: CursorPage;

  @ApiProperty({
    name: "projectId[]",
    isArray: true,
    required: false,
    description: "Filter results by project UUID(s)"
  })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  projectId?: string[];

  @ApiProperty({
    name: "projectShortNames[]",
    isArray: true,
    required: false,
    description: "Filter results by project short name(s)"
  })
  @IsOptional()
  @IsArray()
  projectShortNames?: string[];

  @ApiProperty({
    name: "projectCohort[]",
    isArray: true,
    required: false,
    description: "Filter results by project cohort(s)"
  })
  @IsOptional()
  @IsArray()
  projectCohort?: string[];

  @ApiProperty({
    required: false,
    description: "Filter results by project landscape",
    enum: LandscapeGeometry.LANDSCAPE_SLUGS
  })
  @IsOptional()
  @IsEnum(LandscapeGeometry.LANDSCAPE_SLUGS)
  landscape?: LandscapeSlug;

  @ApiProperty({
    required: false,
    description: "Filter results by tree counts that have been modified since the date provided"
  })
  @IsOptional()
  @IsDate()
  lastModifiedDate?: Date;
}
