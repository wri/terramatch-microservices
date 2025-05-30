import { Get, Query, Controller } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { TreeRestorationGoalDto } from "./dto/tree-restoration-goal.dto";
import { TreeRestorationGoalService } from "./dto/tree-restoration-goal.service";

@Controller("dashboard/v3/treeRestorationGoal")
export class TreeRestorationGoalController {
  constructor(private readonly treeRestorationGoalService: TreeRestorationGoalService) {}

  @Get()
  @JsonApiResponse([TreeRestorationGoalDto])
  @ApiOperation({ operationId: "getTreeRestorationGoal", summary: "Get tree restoration goal statistics" })
  async getTreeRestorationGoal(@Query() query: DashboardQueryDto) {
    const result = await this.treeRestorationGoalService.getTreeRestorationGoal(query);
    return result;
  }
}
