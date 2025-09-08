import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityDto } from "./entity.dto";
import { DisturbanceReport } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

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

  @ApiProperty()
  status: string;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({ nullable: true, type: String, description: "The associated project name" })
  projectName: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated project uuid" })
  projectUuid: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation name" })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: Date })
  dateOfIncident: Date | null;

  @ApiProperty({ nullable: true, type: String })
  intensity: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class DisturbanceReportFullDto extends DisturbanceReportLightDto {
  constructor(
    disturbanceReport: DisturbanceReport,
    props?: HybridSupportProps<DisturbanceReportFullDto, DisturbanceReport>
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

  @ApiProperty({ nullable: true, type: String, isArray: true })
  disturbanceSubtype: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  disturbanceType: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  propertyAffected: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  extent: string | null;
}
