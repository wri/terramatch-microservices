import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiOperation, ApiResponse } from "@nestjs/swagger";
import { ProjectTaskProcessingService } from "./project-task-processing.service";
import {
  ApproveReportsDto,
  ProjectTaskProcessingResponseDto,
  ApproveReportsResponseDto
} from "./dto/project-task-processing.dto";

@Controller("/v3/reportsProject")
export class ProjectTaskProcessingController {
  constructor(private readonly projectTaskProcessingService: ProjectTaskProcessingService) {}

  @Get("/:uuid")
  @ApiOperation({
    operationId: "processProjectTasks",
    summary: "Process all tasks and their associated reports for a given project"
  })
  async processProjectTasks(@Param("uuid") projectUuid: string): Promise<ProjectTaskProcessingResponseDto> {
    return this.projectTaskProcessingService.processProjectTasks(projectUuid);
  }

  @Patch("/approveReports")
  @ApiOperation({
    operationId: "approveReports",
    summary: "Approve reports that are marked with nothingToReport=true"
  })
  @ApiResponse({
    status: 200,
    description: "Reports were successfully approved",
    type: ApproveReportsResponseDto
  })
  async approveReports(@Body() dto: ApproveReportsDto): Promise<ApproveReportsResponseDto> {
    return this.projectTaskProcessingService.approveReports(dto.reportUuids);
  }
}
