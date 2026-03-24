import { BadRequestException, Controller, Get, Header, Query, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ExceptionResponse } from "@terramatch-microservices/common/decorators";
import { EntityCsvExportService } from "./entity-csv-export.service";
import { EntityQueryDto } from "./dto/entity-query.dto";

@Controller("entities/v3/financialReports")
export class FinancialReportController {
  constructor(private readonly entityCsvExportService: EntityCsvExportService) {}

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
  async export(@Query() query: EntityQueryDto) {
    return await this.entityCsvExportService.exportFinancialReportsCsv(query);
  }
}
