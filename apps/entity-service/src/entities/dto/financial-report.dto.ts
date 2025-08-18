import { JsonApiDto } from "@terramatch-microservices/common/decorators";
import { EntityDto } from "./entity.dto";
import { FinancialReport } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportProps } from "@terramatch-microservices/common/dto/hybrid-support.dto";

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

  @ApiProperty({ nullable: true, type: String })
  title: string | null;

  @ApiProperty({ nullable: true, type: Number })
  yearOfReport: number | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  approvedAt: Date | null;

  @ApiProperty({ nullable: true, type: Number })
  completion: number | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class FinancialIndicatorDto {
  @ApiProperty()
  uuid: string;

  @ApiProperty({ nullable: true, type: Number })
  organisationId: number;

  @ApiProperty({ nullable: true, type: Number })
  financialReportId: number;

  @ApiProperty({ nullable: true, type: String })
  collection: string;

  @ApiProperty({ nullable: true, type: Number })
  amount: number;

  @ApiProperty({ nullable: true, type: Number })
  year: number;

  @ApiProperty({ nullable: true, type: String })
  description: string;

  @ApiProperty({ nullable: true, type: Number })
  exchangeRate: number;
}

export class FinancialReportFullDto extends FinancialReportLightDto {
  constructor(financialReport: FinancialReport, props?: HybridSupportProps<FinancialReportFullDto, FinancialReport>) {
    super();
    if (financialReport != null && props != null) {
      populateDto<FinancialReportFullDto, FinancialReport>(this, financialReport, { lightResource: false, ...props });
    }
  }

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
}
