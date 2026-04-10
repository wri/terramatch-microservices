import { BadRequestException, Controller, Get, Header, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { EntityCsvExportService } from "./entity-csv-export.service";
import { PolicyService } from "@terramatch-microservices/common/policies/policy.service";
import { FinancialReport } from "@terramatch-microservices/database/entities";

@Controller("entities/v3/financialReports")
export class FinancialReportController {
  constructor(
    private readonly entityCsvExportService: EntityCsvExportService,
    private readonly policyService: PolicyService
  ) {}

  @Get("export")
  @ApiOperation({
    operationId: "financialReportExportCsv",
    summary: "Export financial reports as CSV (capped row count)."
  })
  @ApiResponse({
    status: 200,
    description: "CSV file",
    content: { "text/csv": { schema: { type: "string" } } }
  })
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed" })
  @Header("Content-Type", "text/csv")
  @Header("Content-Disposition", 'attachment; filename="financial-reports-export.csv"')
  async export() {
    await this.policyService.authorize("export", FinancialReport);
    return await this.entityCsvExportService.exportFinancialReportsCsv();
  }
}
