import { BadRequestException, Controller, Get, Query, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ActionDto } from "@terramatch-microservices/common/dto";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { ActionsService } from "./actions.service";

@Controller("users/v3/actions")
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get()
  @ApiOperation({
    operationId: "actionsIndex",
    summary: "Get actions",
    description: "Returns pending actions for reports and entities associated with the user's projects"
  })
  @JsonApiResponse(ActionDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed" })
  @ExceptionResponse(BadRequestException, { description: "Invalid query parameters" })
  async index(@Query() query: IndexQueryDto) {
    const userId = authenticatedUserId() as number;

    const { data, paginationTotal, pageNumber } = await this.actionsService.getActions(userId, query);

    const document = buildJsonApi(ActionDto, { pagination: "number" });

    for (const { action, target, targetableType } of data) {
      document.addData(action.uuid, new ActionDto(action, target, targetableType));
    }

    return document.addIndex({
      requestPath: `/users/v3/actions${getStableRequestQuery(query)}`,
      total: paginationTotal,
      pageNumber: pageNumber
    });
  }
}
