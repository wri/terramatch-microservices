import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityDto } from "./entity.dto";
import { FinancialReport } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";
import { OrganisationStatus } from "@terramatch-microservices/database/constants/status";
import { FinancialIndicatorDto } from "./financial-indicator.dto";
import { FundingTypeDto } from "./funding-type.dto";

@JsonApiDto({ type: "financialReports" })
export class FinancialReportLightDto extends EntityDto {
  constructor(financialReport?: FinancialReport, props?: HybridSupportProps<FinancialReportLightDto, FinancialReport>) {
    super();
    if (financialReport != null && props != null) {
      populateDto<FinancialReportLightDto, FinancialReport>(this, financialReport, { lightResource: true, ...props });
    }
  }

  @ApiProperty()
  status: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: "The associated organisation name"
  })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: Number })
  yearOfReport: number | null;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class FinancialReportFullDto extends FinancialReportLightDto {
  constructor(financialReport: FinancialReport, props?: HybridSupportProps<FinancialReportFullDto, FinancialReport>) {
    super();
    if (financialReport != null && props != null) {
      populateDto<FinancialReportFullDto, FinancialReport>(this, financialReport, { lightResource: false, ...props });
    }
  }

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: Date })
  approvedAt: Date | null;

  @ApiProperty({ nullable: true, type: Number })
  completion: number | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty()
  updateRequestStatus: string;

  @ApiProperty({ nullable: true, type: String })
  frameworkKey: string | null;

  @ApiProperty({ nullable: true, type: Boolean })
  nothingToReport: boolean | null;

  @ApiProperty({ nullable: true, type: String })
  feedback: string | null;

  @ApiProperty({ nullable: true, type: String, isArray: true })
  feedbackFields: string[] | null;

  @ApiProperty({ nullable: true, type: String })
  answers: string | null;

  @ApiProperty({ nullable: true, type: Number })
  finStartMonth: number | null;

  @ApiProperty({ nullable: true, type: FinancialIndicatorDto, isArray: true })
  financialCollection: FinancialIndicatorDto[] | null;

  @ApiProperty({ nullable: true, type: String })
  currency: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation uuid" })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation type" })
  organisationType: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation status" })
  organisationStatus: OrganisationStatus | null;

  @ApiProperty({ nullable: true, type: FundingTypeDto, isArray: true })
  fundingTypes: FundingTypeDto[] | null;
}
