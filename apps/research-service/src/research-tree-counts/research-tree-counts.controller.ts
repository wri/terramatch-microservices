import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ResearchTreeCount } from "@terramatch-microservices/database/entities";
import { ResearchTreeCountQueryDto } from "./dto/research-tree-count-query.dto";
import { ResearchTreeCountDto } from "./dto/research-tree-count.dto";
import { ResearchTreeCountsService } from "./research-tree-counts.service";

@Controller("research/v3/treeCounts")
export class ResearchTreeCountsController {
  constructor(
    private readonly researchTreeCountsService: ResearchTreeCountsService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "researchTreeCountIndex",
    summary: "Get a paginated list of research tree counts"
  })
  @JsonApiResponse({ data: ResearchTreeCountDto, pagination: "cursor" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to read tree counts" })
  @ExceptionResponse(BadRequestException, { description: "Query params are invalid" })
  async index(@Query() query: ResearchTreeCountQueryDto) {
    await this.policyService.authorize("read", ResearchTreeCount);
    return await this.researchTreeCountsService.addIndex(
      buildJsonApi(ResearchTreeCountDto, { pagination: "cursor" }),
      query
    );
  }

  @Get(":projectUuid")
  @ApiOperation({
    operationId: "researchTreeCountGet",
    summary: "Get the research tree count for a project"
  })
  @ApiParam({ name: "projectUuid", type: String, format: "uuid" })
  @JsonApiResponse(ResearchTreeCountDto)
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to read this tree count" })
  @ExceptionResponse(NotFoundException, { description: "Tree count not found for this project" })
  async get(@Param("projectUuid") projectUuid: string) {
    const treeCount = await this.researchTreeCountsService.findByProjectUuid(projectUuid);
    await this.policyService.authorize("read", treeCount);
    return buildJsonApi(ResearchTreeCountDto).addData(projectUuid, new ResearchTreeCountDto(treeCount));
  }
}
