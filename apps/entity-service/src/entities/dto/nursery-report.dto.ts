import { NurseryReport } from "@terramatch-microservices/database/entities";
import { EntityDto } from "./entity.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators/json-api-dto.decorator";
import { ApiProperty } from "@nestjs/swagger";
import { MediaDto } from "./media.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import {
  REPORT_STATUSES,
  ReportStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";

@JsonApiDto({ type: "nurseryReports" })
export class NurseryReportLightDto extends EntityDto {
  constructor(nurseryReport?: NurseryReport, props?: HybridSupportProps<NurseryReportLightDto, NurseryReport>) {
    super();
    if (nurseryReport != null && props != null) {
      populateDto<NurseryReportLightDto, NurseryReport>(this, nurseryReport, { lightResource: true, ...props });
    }
  }

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated nursery name"
  })
  nurseryName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated nursery uuid"
  })
  nurseryUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  frameworkKey: string | null;

  @ApiProperty({
    description: "Report status for this nursery report",
    enum: REPORT_STATUSES
  })
  status: ReportStatus;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this nursery report",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({ nullable: true, type: Number })
  completion: number | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project uuid"
  })
  projectUuid: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation uuid"
  })
  organisationUuid: string | null;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  taskUuid: string | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: String })
  reportTitle: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ nullable: true, type: Boolean })
  nothingToReport: boolean | null;
}

export type NurseryReportMedia = Pick<NurseryReportFullDto, keyof typeof NurseryReport.MEDIA>;

export class NurseryReportFullDto extends NurseryReportLightDto {
  constructor(
    nurseryReport: NurseryReport,
    props: HybridSupportProps<NurseryReportFullDto, Omit<NurseryReport, "feedback" | "feedbackFields">>
  ) {
    super();
    populateDto<NurseryReportFullDto, NurseryReport>(this, nurseryReport, { lightResource: false, ...props });
  }

  @ApiProperty({ nullable: true, type: String })
  reportTitle: string | null;

  @ApiProperty({ nullable: true, type: String })
  projectReportTitle: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated nursery name"
  })
  nurseryName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated nursery uuid"
  })
  nurseryUuid: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation uuid"
  })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: Number })
  seedlingsYoungTrees: number | null;

  @ApiProperty({ nullable: true, type: String })
  interestingFacts: string | null;

  @ApiProperty({ nullable: true, type: String })
  sitePrep: string | null;

  @ApiProperty({ nullable: true, type: String })
  sharedDriveLink: string | null;

  @ApiProperty({ nullable: true, type: String })
  createdByFirstName: string | null;

  @ApiProperty({ nullable: true, type: String })
  createdByLastName: string | null;

  @ApiProperty({ nullable: true, type: String })
  approvedByFirstName: string | null;

  @ApiProperty({ nullable: true, type: String })
  approvedByLastName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project uuid"
  })
  projectUuid: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated task uuid"
  })
  taskUuid: string | null;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  media: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  file: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  otherAdditionalDocuments: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  treeSeedlingContributions: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  photos: MediaDto[];
}
