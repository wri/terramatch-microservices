import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityDto } from "./entity.dto";
import { FinancialReport } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import {
  ENTITY_STATUSES,
  EntityStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";
import { MediaDto } from "./media.dto";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

@JsonApiDto({ type: "financial-reports" })
export class FinancialReportLightDto extends EntityDto {
  constructor(financialReport?: FinancialReport, props?: HybridSupportProps<FinancialReportLightDto, FinancialReport>) {
    super();
    if (financialReport != null && props != null) {
      populateDto<FinancialReportLightDto, FinancialReport>(this, financialReport, { lightResource: true, ...props });
    }
  }

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: String, description: "Framework key for this financial report" })
  frameworkKey: string | null;

  @ApiProperty({
    nullable: true,
    description: "Entity status for this financial report",
    enum: ENTITY_STATUSES
  })
  status: EntityStatus | null;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this financial report",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project name"
  })
  projectName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project organisation name"
  })
  organisationName: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated project organisation UUID"
  })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: Number })
  yearOfReport: number | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export type FinancialReportMedia = Pick<FinancialReportFullDto, keyof typeof FinancialReport.MEDIA>;

export class FinancialReportFullDto extends FinancialReportLightDto {
  constructor(financialReport: FinancialReport, props: HybridSupportProps<FinancialReportFullDto, FinancialReport>) {
    super();
    populateDto<FinancialReportFullDto, FinancialReport>(this, financialReport, { lightResource: false, ...props });
  }

  @ApiProperty({ nullable: true, type: String })
  description: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  tags: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  projectUuid: string | null;

  @ApiProperty({ type: () => MediaDto, isArray: true })
  documentation: MediaDto[];

  @ApiProperty({ type: () => MediaDto, isArray: true })
  financialDocuments: MediaDto[];
}
