import { NurseryReport } from "@terramatch-microservices/database/entities";
import { EntityDto, AdditionalProps } from "./entity.dto";
import { pickApiProperties } from "@terramatch-microservices/common/dto/json-api-attributes";
import { JsonApiDto } from "@terramatch-microservices/common/decorators/json-api-dto.decorator";
import { ApiProperty } from "@nestjs/swagger";
import { MediaDto } from "./media.dto";

@JsonApiDto({ type: "nurseryReports" })
export class NurseryReportLightDto extends EntityDto {
  constructor(nurseryReport?: NurseryReport, props?: AdditionalNurseryReportLightProps) {
    super();
    if (nurseryReport != null) {
      this.populate(NurseryReportLightDto, {
        ...pickApiProperties(nurseryReport, NurseryReportLightDto),
        lightResource: true,
        // these two are untyped and marked optional in the base model.
        createdAt: nurseryReport.createdAt as Date,
        updatedAt: nurseryReport.updatedAt as Date,
        ...props
      });
    }
  }

  @ApiProperty({
    nullable: true,
    description: "The associated nursery name"
  })
  nurseryName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated nursery uuid"
  })
  nurseryUuid: string | null;

  @ApiProperty()
  frameworkKey: string | null;

  @ApiProperty()
  frameworkUuid: string | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({
    nullable: true,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated project uuid"
  })
  projectUuid: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated organisation uuid"
  })
  organisationUuid: string | null;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true })
  taskUuid: string | null;

  @ApiProperty()
  dueAt: Date | null;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty({ nullable: true })
  reportTitle: string | null;

  @ApiProperty()
  createdAt: Date;
}

export type AdditionalNurseryReportLightProps = Pick<NurseryReportLightDto, "reportTitle">;
export type AdditionalNurseryReportFullProps = AdditionalNurseryReportLightProps &
  AdditionalProps<NurseryReportFullDto, NurseryReportLightDto & Omit<NurseryReport, "nursery">>;
export type NurseryReportMedia = Pick<NurseryReportFullDto, keyof typeof NurseryReport.MEDIA>;

export class NurseryReportFullDto extends NurseryReportLightDto {
  constructor(nurseryReport: NurseryReport, props?: AdditionalNurseryReportFullProps) {
    super();
    if (nurseryReport != null) {
      this.populate(NurseryReportFullDto, {
        ...pickApiProperties(nurseryReport, NurseryReportFullDto),
        lightResource: false,
        // these two are untyped and marked optional in the base model.
        createdAt: nurseryReport.createdAt as Date,
        updatedAt: nurseryReport.updatedAt as Date,
        ...props
      });
    }
  }

  @ApiProperty({ nullable: true })
  reportTitle: string | null;

  @ApiProperty({ nullable: true })
  projectReportTitle: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated nursery name"
  })
  nurseryName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated nursery uuid"
  })
  nurseryUuid: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated organisation uuid"
  })
  organisationUuid: string | null;

  @ApiProperty()
  dueAt: Date | null;

  @ApiProperty()
  status: string;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({ nullable: true })
  feedback: string | null;

  @ApiProperty({ nullable: true })
  feedbackFields: string[] | null;

  @ApiProperty()
  nothingToReport: boolean;

  @ApiProperty({ nullable: true })
  completion: number | null;

  @ApiProperty({ nullable: true })
  title: string | null;

  @ApiProperty({ nullable: true })
  seedlingsYoungTrees: number | null;

  @ApiProperty({ nullable: true })
  interestingFacts: string | null;

  @ApiProperty({ nullable: true })
  sitePrep: string | null;

  @ApiProperty({ nullable: true })
  sharedDriveLink: string | null;

  @ApiProperty({ nullable: true })
  createdByFirstName: string | null;

  @ApiProperty({ nullable: true })
  createdByLastName: string | null;

  @ApiProperty({ nullable: true })
  approvedByFirstName: string | null;

  @ApiProperty({ nullable: true })
  approvedByLastName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated project uuid"
  })
  projectUuid: string | null;

  @ApiProperty({
    nullable: true,
    description: "The associated task uuid"
  })
  taskUuid: string | null;

  @ApiProperty({ nullable: true })
  submittedAt: Date | null;

  @ApiProperty()
  migrated: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  file: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  otherAdditionalDocuments: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  treeSeedlingContributions: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  photos: MediaDto[];
}
