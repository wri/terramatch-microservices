import { ApiProperty } from "@nestjs/swagger";
import { IsUUID } from "class-validator";
import { JsonApiDataDto, JsonApiMultiBodyDto } from "@terramatch-microservices/common/util/json-api-update-dto";

export class EntityCreateAttributes {
  @IsUUID()
  @ApiProperty({ description: "UUID of the entity related to the report", required: true })
  entityUuid: string;
}

// Create data DTOs
export class ProjectCreateData extends JsonApiDataDto({ type: "projects" }, EntityCreateAttributes) {}
export class SiteCreateData extends JsonApiDataDto({ type: "sites" }, EntityCreateAttributes) {}
export class NurseryCreateData extends JsonApiDataDto({ type: "nurseries" }, EntityCreateAttributes) {}
export class ProjectReportCreateData extends JsonApiDataDto({ type: "projectReports" }, EntityCreateAttributes) {}
export class SiteReportCreateData extends JsonApiDataDto({ type: "siteReports" }, EntityCreateAttributes) {}
export class NurseryReportCreateData extends JsonApiDataDto({ type: "nurseryReports" }, EntityCreateAttributes) {}
export class FinancialReportCreateData extends JsonApiDataDto({ type: "financialReports" }, EntityCreateAttributes) {}
export class DisturbanceReportCreateData extends JsonApiDataDto(
  { type: "disturbanceReports" },
  EntityCreateAttributes
) {}

// Union type for all create data
export type EntityCreateData = EntityCreateAttributes;

// Multi-body DTO for handling different entity types
export class EntityCreateBody extends JsonApiMultiBodyDto([
  ProjectCreateData,
  SiteCreateData,
  NurseryCreateData,
  ProjectReportCreateData,
  SiteReportCreateData,
  NurseryReportCreateData,
  FinancialReportCreateData,
  DisturbanceReportCreateData
] as const) {}
