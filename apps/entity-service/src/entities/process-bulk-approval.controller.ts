import { Controller, Get, Param } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ProcessBulkApprovalService } from "./process-bulk-approval.service";
import { processBulkApprovalDto } from "./dto/process-bulk-approval.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";

@Controller("entities/v3/projectTaskProcessing")
export class ProcessBulkApprovalController {
  constructor(private readonly processBulkApprovalService: ProcessBulkApprovalService) {}

  @Get("/:uuid")
  @ApiOperation({
    operationId: "processbulkApproval",
    summary: "Process all tasks and their associated reports for a given project"
  })
  @JsonApiResponse(processBulkApprovalDto)
  async processbulkApproval(@Param("uuid") projectUuid: string) {
    const response = await this.processBulkApprovalService.processbulkApproval(projectUuid);
    const document = buildJsonApi(processBulkApprovalDto);
    document.addData(projectUuid, new processBulkApprovalDto(response));
    return document.serialize();
  }
}
