import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { ApiProperty } from "@nestjs/swagger";
import { Framework } from "@terramatch-microservices/database/entities";
import { AdditionalProps, populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import {
  CreateDataDto,
  JsonApiBodyDto,
  JsonApiDataDto
} from "@terramatch-microservices/common/util/json-api-update-dto";
import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";

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

const FORM_UUID_API_PROPERTY = { required: false, nullable: true, type: String, format: "uuid" as const };
export class ReportingFrameworkFormUuidAttributes {
  @IsOptional()
  @IsString()
  @ApiProperty({
    required: false,
    nullable: true,
    type: String,
    description: "Stored in DB only; not returned in API (FE uses slug)"
  })
  accessCode?: string | null;

  @IsOptional()
  @IsUUID()
  @ApiProperty(FORM_UUID_API_PROPERTY)
  projectFormUuid?: string | null;

  @IsOptional()
  @IsUUID()
  @ApiProperty(FORM_UUID_API_PROPERTY)
  projectReportFormUuid?: string | null;

  @IsOptional()
  @IsUUID()
  @ApiProperty(FORM_UUID_API_PROPERTY)
  siteFormUuid?: string | null;

  @IsOptional()
  @IsUUID()
  @ApiProperty(FORM_UUID_API_PROPERTY)
  siteReportFormUuid?: string | null;

  @IsOptional()
  @IsUUID()
  @ApiProperty(FORM_UUID_API_PROPERTY)
  nurseryFormUuid?: string | null;

  @IsOptional()
  @IsUUID()
  @ApiProperty(FORM_UUID_API_PROPERTY)
  nurseryReportFormUuid?: string | null;
}

export class CreateReportingFrameworkAttributes extends ReportingFrameworkFormUuidAttributes {
  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: "Framework name; used to generate slug" })
  name: string;
}

export class UpdateReportingFrameworkAttributes extends ReportingFrameworkFormUuidAttributes {
  @IsOptional()
  @IsString()
  @ApiProperty({ required: false, nullable: true, type: String })
  name?: string | null;
}

export class CreateReportingFrameworkBody extends JsonApiBodyDto(
  class CreateReportingFrameworkData extends CreateDataDto("reportingFrameworks", CreateReportingFrameworkAttributes) {}
) {}

export class UpdateReportingFrameworkBody extends JsonApiBodyDto(
  class UpdateReportingFrameworkData extends JsonApiDataDto(
    { type: "reportingFrameworks", id: "string" },
    UpdateReportingFrameworkAttributes
  ) {}
) {}
