import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityDto } from "./entity.dto";
import { DisturbanceReport } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { DisturbanceReportEntryDto } from "@terramatch-microservices/common/dto/disturbance-report-entry.dto";
import { MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import {
  REPORT_STATUSES,
  ReportStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";

@JsonApiDto({ type: "disturbanceReports" })
export class DisturbanceReportLightDto extends EntityDto {
  constructor(
    disturbanceReport?: DisturbanceReport,
    props?: HybridSupportProps<DisturbanceReportLightDto, DisturbanceReport>
  ) {
    super();
    if (disturbanceReport != null && props != null) {
      populateDto<DisturbanceReportLightDto, DisturbanceReport>(this, disturbanceReport, {
        lightResource: true,
        ...props
      });
    }
  }

  @ApiProperty({
    description: "Entity status for this disturbance report",
    enum: REPORT_STATUSES
  })
  status: ReportStatus;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this disturbance report",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated project name" })
  projectName: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated project uuid" })
  projectUuid: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation name" })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation uuid" })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: Date })
  intensity: string | null;

  @ApiProperty({ nullable: true, type: Date })
  dateOfDisturbance: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: DisturbanceReportEntryDto, isArray: true })
  entries: DisturbanceReportEntryDto[] | null;

  @ApiProperty({ type: Number })
  reportId: number;
}

export type DisturbanceReportMedia = Pick<DisturbanceReportFullDto, keyof typeof DisturbanceReport.MEDIA>;

export class DisturbanceReportFullDto extends DisturbanceReportLightDto {
  constructor(
    disturbanceReport: DisturbanceReport,
    props?: HybridSupportProps<DisturbanceReportFullDto, Omit<DisturbanceReport, "feedback" | "feedbackFields">>
  ) {
    super();
    if (disturbanceReport != null && props != null) {
      populateDto<DisturbanceReportFullDto, DisturbanceReport>(this, disturbanceReport, {
        lightResource: false,
        ...props
      });
    }
  }

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: Date })
  approvedAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty({ nullable: true, type: Number })
  completion: number | null;

  @ApiProperty({ nullable: true, type: Boolean })
  nothingToReport: boolean | null;

  @ApiProperty({ nullable: true, type: String })
  frameworkKey: string | null;

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  answers: string | null;

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: String })
  actionDescription: string | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  media: MediaDto[];
}
