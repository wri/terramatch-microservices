import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ProjectTaskProcessingService } from "./project-task-processing.service";
import {
  ApproveReportsDto,
  ProjectTaskProcessingResponseDto,
  ApproveReportsResponseDto
} from "./dto/project-task-processing.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";

@Controller("entities/v3/projectTaskProcessing")
export class ProjectTaskProcessingController {
  constructor(private readonly projectTaskProcessingService: ProjectTaskProcessingService) {}

  @Get("/:uuid")
  @ApiOperation({
    operationId: "processProjectTasks",
    summary: "Process all tasks and their associated reports for a given project"
  })
  @JsonApiResponse(ProjectTaskProcessingResponseDto)
  async processProjectTasks(@Param("uuid") projectUuid: string) {
    const response = await this.projectTaskProcessingService.processProjectTasks(projectUuid);
    const document = buildJsonApi(ProjectTaskProcessingResponseDto);
    document.addData(projectUuid, new ProjectTaskProcessingResponseDto(response));
    return document.serialize();
  }

  @Patch("/approveReports")
  @ApiOperation({
    operationId: "approveReports",
    summary: "Approve reports that are marked with nothingToReport=true"
  })
  @JsonApiResponse(ApproveReportsResponseDto)
  async approveReports(@Body() dto: ApproveReportsDto) {
    const response = await this.projectTaskProcessingService.approveReports(dto.reportUuids);
    const document = buildJsonApi(ApproveReportsResponseDto);
    document.addData("approve-reports", new ApproveReportsResponseDto(response));
    return document.serialize();
  }
}
