import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";
import { CreateDataDto, JsonApiMultiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class EntityCreateAttributes {
  @IsUUID()
  @ApiProperty({ description: "UUID of the parent entity.", required: true })
  parentUuid: string;
}

export class ProjectCreateAttributes {
  @IsUUID()
  @IsOptional()
  @ApiProperty({ description: "UUID of the application.", required: false })
  applicationUuid?: string;

  @IsUUID()
  @ApiProperty({ description: "UUID of the form for project creation.", required: true })
  formUuid: string;
}

// Create data DTOs - Only for supported entity types
export class DisturbanceReportCreateData extends CreateDataDto("disturbanceReports", EntityCreateAttributes) {}
export class SiteCreateData extends CreateDataDto("sites", EntityCreateAttributes) {}
export class NurseryCreateData extends CreateDataDto("nurseries", EntityCreateAttributes) {}
export class ProjectCreateData extends CreateDataDto("projects", ProjectCreateAttributes) {}

// Union type for all create data
export type EntityCreateData = EntityCreateAttributes | ProjectCreateAttributes;

// Multi-body DTO for handling different entity types
export class EntityCreateBody extends JsonApiMultiBodyDto([
  DisturbanceReportCreateData,
  SiteCreateData,
  NurseryCreateData,
  ProjectCreateData
] as const) {}
