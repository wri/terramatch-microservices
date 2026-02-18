import { JsonApiDto } from "../decorators";
import { AssociationDto } from "./association.dto";
import { FinancialReport } from "@terramatch-microservices/database/entities";
import { populateDto } from "./json-api-attributes";
import { ApiProperty } from "@nestjs/swagger";
import { HybridSupportProps } from "./hybrid-support.dto";
import {
  REPORT_STATUSES,
  ReportStatus,
  UPDATE_REQUEST_STATUSES,
  UpdateRequestStatus
} from "@terramatch-microservices/database/constants/status";

@JsonApiDto({ type: "financialReports" })
export class FinancialReportLightDto extends AssociationDto {
  constructor(financialReport?: FinancialReport, props?: HybridSupportProps<FinancialReportLightDto, FinancialReport>) {
    super();
    if (financialReport != null && props != null) {
      populateDto<FinancialReportLightDto, FinancialReport>(this, financialReport, props);
    }
  }

  @ApiProperty()
  uuid: string;

  @ApiProperty({
    description: "Report status for this financial report",
    enum: REPORT_STATUSES
  })
  status: ReportStatus;

  @ApiProperty({
    nullable: true,
    description: "Update request status for this financial report",
    enum: UPDATE_REQUEST_STATUSES
  })
  updateRequestStatus: UpdateRequestStatus | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation name" })
  organisationName: string | null;

  @ApiProperty({ nullable: true, type: String, description: "The associated organisation uuid" })
  organisationUuid: string | null;

  @ApiProperty({ nullable: true, type: Number })
  yearOfReport: number | null;

  @ApiProperty({ nullable: true, type: Date })
  submittedAt: Date | null;

  @ApiProperty({ nullable: true, type: Date })
  dueAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
