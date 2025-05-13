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
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { ProjectUser, SiteReport, Task, TreeSpecies } from "@terramatch-microservices/database/entities";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";
import { TaskGetDto, TaskQueryDto } from "./dto/task-query.dto";
import { ProjectReportLightDto } from "./dto/project-report.dto";
import { SiteReportLightDto } from "./dto/site-report.dto";
import { NurseryReportLightDto } from "./dto/nursery-report.dto";
import { EntitiesService, ProcessableEntity } from "./entities.service";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { TaskFullDto, TaskLightDto } from "./dto/task.dto";
import { Op } from "sequelize";

const FILTER_PROPS = {
  status: "status",
  frameworkKey: "$project.framework_key$",
  projectUuid: "$project.uuid$",
  organisationUuid: "$organisation.uuid$"
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
  @JsonApiResponse({ data: TaskLightDto, pagination: "number" })
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  async taskIndex(@Query() query: TaskQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Task, query.page, [
      // required: true avoids loading tasks attached to deleted projects or orgs
      { association: "organisation", attributes: ["name"], required: true },
      { association: "project", attributes: ["name", "frameworkKey"], required: true }
    ]);

    const permissions = await this.policyService.getPermissions();
    const frameworkPermissions = permissions
      ?.filter(name => name.startsWith("framework-"))
      ?.map(name => name.substring("framework-".length) as string);
    if (frameworkPermissions?.length > 0) {
      builder.where({ "$project.framework_key$": { [Op.in]: frameworkPermissions } });
    } else {
      if (query.projectUuid == null && query.organisationUuid == null) {
        // non-admin users should typically be filtering on a project or org, but to cover our bases,
        // return all tasks they have direct access to if they aren't.
        if (permissions?.includes("manage-own")) {
          builder.where({ projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.policyService.userId) } });
        } else if (permissions?.includes("projects-manage")) {
          builder.where({ projectId: { [Op.in]: ProjectUser.projectsManageSubquery(this.policyService.userId) } });
        }
      }

      if (query.sort == null) {
        // For non-admins, the default sort is dueAt descending
        builder.order(["dueAt", "DESC"]);
      }
    }

    for (const [filterProp, sqlProp] of Object.entries(FILTER_PROPS)) {
      if (query[filterProp] != null) {
        builder.where({ [sqlProp]: query[filterProp] });
      }
    }

    if (query.sort != null) {
      if (["dueAt", "updatedAt", "status"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["project", "name", query.sort.direction ?? "ASC"]);
      }
    }

    const document = buildJsonApi(TaskLightDto, { pagination: "number" });
    const tasks = await builder.execute();
    const indexIds: string[] = [];
    if (tasks.length !== 0) {
      await this.policyService.authorize("read", tasks);

      for (const task of tasks) {
        indexIds.push(task.uuid);
        document.addData(task.uuid, new TaskLightDto(task));
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

    const treesPlantedCount =
      (await TreeSpecies.visible()
        .collection("tree-planted")
        .siteReports(SiteReport.approvedIdsForTaskSubquery(task.id))
        .sum("amount")) ?? 0;

    const document = buildJsonApi(TaskFullDto);
    const taskResource = document.addData(task.uuid, new TaskFullDto(task, { treesPlantedCount }));

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
        const reportResource = document.addData(id, reportDto);
        taskResource.relateTo(entityType === "projectReports" ? "projectReport" : entityType, reportResource, {
          forceMultiple: true
        });
      }
    }

    return document.serialize();
  }
}
