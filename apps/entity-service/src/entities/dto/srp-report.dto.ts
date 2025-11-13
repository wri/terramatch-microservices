import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityDto } from "./entity.dto";
import { SrpReport } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { MediaDto } from "./media.dto";

@JsonApiDto({ type: "srpReports" })
export class SrpReportLightDto extends EntityDto {
  constructor(srpReport?: SrpReport, props?: HybridSupportProps<SrpReportLightDto, SrpReport>) {
    super();
    if (srpReport != null && props != null) {
      populateDto<SrpReportLightDto, SrpReport>(this, srpReport, {
        lightResource: true,
        ...props
      });
    }
  }

  @ApiProperty()
  status: string;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({ nullable: true, type: Number })
  completion: number | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated project name" })
  projectName: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated project uuid" })
  projectUuid: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation name" })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation uuid"
  })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: String })
  taskUuid: string | null;

  @ApiProperty()
  projectStatus: string;

  @ApiProperty({ nullable: true, type: Number })
  year: number | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;
}

export type SrpReportMedia = Pick<SrpReportFullDto, keyof typeof SrpReport.MEDIA>;

export class SrpReportFullDto extends SrpReportLightDto {
  constructor(srpReport: SrpReport, props?: HybridSupportProps<SrpReportFullDto, SrpReport>) {
    super();
    if (srpReport != null && props != null) {
      populateDto<SrpReportFullDto, SrpReport>(this, srpReport, {
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
  otherRestorationPartnersDescription: string | null;

  @ApiProperty({ type: Number })
  totalUniqueRestorationPartners: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated task uuid"
  })
  taskUuid: string | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  media: MediaDto[];
}
