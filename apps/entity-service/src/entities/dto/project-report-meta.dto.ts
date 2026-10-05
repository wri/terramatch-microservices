import { ApiProperty } from "@nestjs/swagger";
import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Dictionary } from "lodash";

export class ReportMetaDto {
  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({
    description: 'The number of reports for this entity with a status of "due", "draft" or "information-required"'
  })
  reportsRequiringAttention: number;
}

@JsonApiDto({ type: "projectReportsMetas" })
export class ProjectReportMetaDto {
  constructor(data: ProjectReportMetaDto) {
    populateDto<ProjectReportMetaDto>(this, data);
  }

  @ApiProperty({ nullable: true, type: String })
  name: string | null;

  @ApiProperty({
    type: "object",
    additionalProperties: { $ref: "#/components/schemas/ReportMetaDto" },
    description: "Report meta for each site in this project, keyed by site UUID"
  })
  sites: Dictionary<ReportMetaDto>;

  @ApiProperty({
    type: "object",
    additionalProperties: { $ref: "#/components/schemas/ReportMetaDto" },
    description: "Report meta for each nursery in this project, keyed by nursery UUID"
  })
  nurseries: Dictionary<ReportMetaDto>;
}
