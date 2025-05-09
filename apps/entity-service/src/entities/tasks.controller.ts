import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { TaskDto } from "./dto/task.dto";
import { IndexQueryDto } from "./dto/index-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Task } from "@terramatch-microservices/database/entities";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";

@Controller("entities/v3/tasks")
export class TasksController {
  constructor(private readonly policyService: PolicyService) {}

  @Get()
  @ApiOperation({
    operationId: "taskIndex",
    summary: "Get a paginated and filtered list of tasks"
  })
  @JsonApiResponse({ data: TaskDto, pagination: "number" })
  async taskIndex(@Query() query: IndexQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Task, query.page, [
      // required: true avoids loading tasks attached to deleted projects or orgs
      { association: "organisation", attributes: ["name"], required: true },
      { association: "project", attributes: ["name", "frameworkKey"], required: true }
    ]);

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
}
