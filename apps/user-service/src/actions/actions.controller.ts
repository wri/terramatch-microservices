import { BadRequestException, Controller, Get, Query, UnauthorizedException } from "@nestjs/common";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { ActionDto } from "@terramatch-microservices/common/dto";
import { IndexQueryDto } from "@terramatch-microservices/common/dto/index-query.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { MAX_PAGE_SIZE } from "@terramatch-microservices/common/util/paginated-query.builder";
import { ProjectLightDto } from "../../../entity-service/src/entities/dto/project.dto";
import { SiteLightDto } from "../../../entity-service/src/entities/dto/site.dto";
import { NurseryLightDto } from "../../../entity-service/src/entities/dto/nursery.dto";
import { ProjectReportLightDto } from "../../../entity-service/src/entities/dto/project-report.dto";
import { SiteReportLightDto } from "../../../entity-service/src/entities/dto/site-report.dto";
import { NurseryReportLightDto } from "../../../entity-service/src/entities/dto/nursery-report.dto";
import { ActionsService } from "./actions.service";

@Controller("users/v3/actions")
@ApiExtraModels(
  ProjectLightDto,
  SiteLightDto,
  NurseryLightDto,
  ProjectReportLightDto,
  SiteReportLightDto,
  NurseryReportLightDto
)
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get()
  @ApiOperation({
    operationId: "indexMyActions",
    summary: "Get actions for the authenticated user",
    description: "Returns pending actions for reports and entities associated with the user's projects"
  })
  @JsonApiResponse(ActionDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed" })
  @ExceptionResponse(BadRequestException, { description: "Invalid query parameters" })
  async indexMyActions(@Query() query: IndexQueryDto) {
    const userId = authenticatedUserId();
    if (userId == null) {
      throw new Error("User ID not found in request context");
    }

    // Get actions from service
    const { data, paginationTotal, pageNumber } = await this.actionsService.getMyActions(userId, query);

    // Build JSON:API document
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
