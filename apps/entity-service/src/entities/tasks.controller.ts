import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { TaskDto } from "./dto/task.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Task } from "@terramatch-microservices/database/entities";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";
import { TaskGetDto, TaskQueryDto } from "./dto/task-query.dto";
import { ProjectReportLightDto } from "./dto/project-report.dto";
import { SiteReportLightDto } from "./dto/site-report.dto";
import { NurseryReportLightDto } from "./dto/nursery-report.dto";
import { EntitiesService, ProcessableEntity } from "./entities.service";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

const FILTER_PROPS = {
  status: "status",
  frameworkKey: "$project.framework_key$",
  projectUuid: "$project.uuid$"
};

@Controller("entities/v3/tasks")
export class TasksController {
  private readonly logger = new TMLogger(TasksController.name);

  constructor(private readonly policyService: PolicyService, private readonly entitiesService: EntitiesService) {}

  @Get()
  @ApiOperation({
    operationId: "taskIndex",
    summary: "Get a paginated and filtered list of tasks"
  })
  @JsonApiResponse({ data: TaskDto, pagination: "number" })
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  async taskIndex(@Query() query: TaskQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Task, query.page, [
      // required: true avoids loading tasks attached to deleted projects or orgs
      { association: "organisation", attributes: ["name"], required: true },
      { association: "project", attributes: ["name", "frameworkKey"], required: true }
    ]);

    for (const [filterProp, sqlProp] of Object.entries(FILTER_PROPS)) {
      if (query[filterProp] != null) {
        builder.where({ [sqlProp]: query[filterProp] });
      }
    }

    if (query.sort != null) {
      if (["dueAt", "updatedAt"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["project", "name", query.sort.direction ?? "ASC"]);
      }
    }

    const document = buildJsonApi(TaskDto, { pagination: "number" });
    const tasks = await builder.execute();
    const indexIds: string[] = [];
    if (tasks.length !== 0) {
      await this.policyService.authorize("read", tasks);

      for (const task of tasks) {
        indexIds.push(task.uuid);
        document.addData(task.uuid, new TaskDto(task));
      }
    }

    document.addIndexData({
      resource: "tasks",
      requestPath: `/entities/v3/tasks${getStableRequestQuery(query)}`,
      ids: indexIds,
      total: await builder.paginationTotal(),
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
      type: TaskDto,
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
  async taskGet(@Param() { uuid }: TaskGetDto) {
    const task = await Task.findOne({
      where: { uuid },
      include: [
        { association: "organisation", attributes: ["name"], required: true },
        { association: "project", attributes: ["name", "frameworkKey"], required: true }
      ]
    });
    if (task == null) throw new NotFoundException();

    await this.policyService.authorize("read", task);

    const document = buildJsonApi(TaskDto);
    const taskResource = document.addData(task.uuid, new TaskDto(task));

    for (const entityType of ["projectReports", "siteReports", "nurseryReports"] as ProcessableEntity[]) {
      const processor = this.entitiesService.createEntityProcessor(entityType);
      const reports = await processor.findMany({ taskId: task.id });
      if (entityType === "projectReports" && reports.models.length > 1) {
        this.logger.error(`More than one project report found for task ${task.id}`);
        // Make sure we don't accidentally turn the `projectReport` member into an array, as the FE expects an object.
        reports.models.length = 1;
      }
      for (const report of reports.models) {
        const { id, dto: reportDto } = await processor.getLightDto(report);
        const reportResource = document.addIncluded(id, reportDto);
        taskResource.relateTo(entityType === "projectReports" ? "projectReport" : entityType, reportResource, {
          forceMultiple: true
        });
      }
    }

    return document.serialize();
  }
}
