import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { Framework } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

type ReportingFrameworkExtras = "totalProjectsCount";
type ReportingFrameworkWithoutExtras = Omit<Framework, ReportingFrameworkExtras>;

@JsonApiDto({ type: "reportingFrameworks" })
export class ReportingFrameworkDto {
  constructor(
    framework?: Framework,
    additional?: AdditionalProps<ReportingFrameworkDto, ReportingFrameworkWithoutExtras>
  ) {
    if (framework != null && additional != null) {
      populateDto<ReportingFrameworkDto, ReportingFrameworkWithoutExtras>(this, framework, additional);
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true, type: String })
  slug: string | null;

  @ApiProperty({ nullable: true, type: String })
  accessCode: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectFormUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectReportFormUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  siteFormUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  siteReportFormUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  nurseryFormUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  nurseryReportFormUuid: string | null;

  @ApiProperty()
  totalProjectsCount: number;
}
