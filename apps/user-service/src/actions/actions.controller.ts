import { BadRequestException, Controller, Get, UnauthorizedException } from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ActionDto } from "@terramatch-microservices/common/dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";
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
  async index() {
    const userId = authenticatedUserId() as number;

    const data = await this.actionsService.getActions(userId);

    const document = buildJsonApi(ActionDto);

    for (const { action, target, targetableType } of data) {
      document.addData(action.uuid, new ActionDto(action, target, targetableType));
    }

    return document;
  }
}
