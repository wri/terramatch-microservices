import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";
import { SingleTaskDto, TaskQueryDto } from "./dto/task-query.dto";
import { ProjectReportLightDto } from "./dto/project-report.dto";
import { SiteReportLightDto } from "./dto/site-report.dto";
import { NurseryReportLightDto } from "./dto/nursery-report.dto";
import { TaskFullDto, TaskLightDto } from "./dto/task.dto";
import { TaskUpdateBody } from "./dto/task-update.dto";
import { TasksService } from "./tasks.service";

@Controller("entities/v3/tasks")
export class TasksController {
  constructor(private readonly policyService: PolicyService, private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({
    operationId: "taskIndex",
    summary: "Get a paginated and filtered list of tasks"
  })
  @JsonApiResponse({
    data: {
      type: TaskLightDto,
      relationships: [
        { name: "siteReports", type: SiteReportLightDto, multiple: true },
        { name: "nurseryReports", type: NurseryReportLightDto, multiple: true }
      ]
    },
    included: [SiteReportLightDto, NurseryReportLightDto],
    pagination: "number"
  })
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  async taskIndex(@Query() query: TaskQueryDto) {
    const { tasks, total } = await this.tasksService.getTasks(query);
    const document = buildJsonApi(TaskLightDto, { pagination: "number" });
    const indexIds: string[] = [];
    if (tasks.length !== 0) {
      await this.policyService.authorize("read", tasks);

      for (const task of tasks) {
        indexIds.push(task.uuid);

        await this.tasksService.addFullTaskDto(document, task);
      }
    }

    document.addIndexData({
      resource: "tasks",
      requestPath: `/entities/v3/tasks${getStableRequestQuery(query)}`,
      ids: indexIds,
      total,
      pageNumber: query.page?.number ?? 1
    });

    return document.serialize();
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "taskGet",
    summary: "Get a single task by UUID. Includes all reports light DTOs sideloaded on the response."
  })
  @JsonApiResponse({
    data: {
      type: TaskFullDto,
      relationships: [
        { name: "projectReport", type: ProjectReportLightDto },
        { name: "siteReports", type: SiteReportLightDto, multiple: true },
        { name: "nurseryReports", type: NurseryReportLightDto, multiple: true }
      ]
    },
    included: [ProjectReportLightDto, SiteReportLightDto, NurseryReportLightDto]
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async taskGet(@Param() { uuid }: SingleTaskDto) {
    const task = await this.tasksService.getTask(uuid);
    await this.policyService.authorize("read", task);
    return (await this.tasksService.addFullTaskDto(buildJsonApi(TaskFullDto), task)).serialize();
  }

  @Patch(":uuid")
  @ApiOperation({
    operationId: "taskUpdate",
    summary: "Update a single task by UUID. Includes all reports light DTOs sideloaded on the response."
  })
  @JsonApiResponse({
    data: {
      type: TaskFullDto,
      relationships: [
        { name: "projectReport", type: ProjectReportLightDto },
        { name: "siteReports", type: SiteReportLightDto, multiple: true },
        { name: "nurseryReports", type: NurseryReportLightDto, multiple: true }
      ]
    },
    included: [ProjectReportLightDto, SiteReportLightDto, NurseryReportLightDto]
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async taskUpdate(@Param() { uuid }: SingleTaskDto, @Body() updatePayload: TaskUpdateBody) {
    if (uuid !== updatePayload.data.id) {
      throw new BadRequestException("Task id in path and payload do not match");
    }

    const task = await this.tasksService.getTask(uuid);
    await this.policyService.authorize("update", task);

    // the only field updateable on Task is status
    const { status } = updatePayload.data.attributes;

    if (status != null) {
      if (status === "awaiting-approval") {
        await this.tasksService.submitForApproval(task);
      } else {
        throw new BadRequestException(`Status not supported by this controller: ${status}`);
      }
    }

    await task.save();

    return (await this.tasksService.addFullTaskDto(buildJsonApi(TaskFullDto), task)).serialize();
  }
}
