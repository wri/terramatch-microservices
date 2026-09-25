import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { PolicyService } from "@terramatch-microservices/common";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { buildDeletedResponse, buildJsonApi, getDtoType } from "@terramatch-microservices/common/util";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { ResearchTreeCount } from "@terramatch-microservices/database/entities";
import { ResearchTreeCountQueryDto } from "./dto/research-tree-count-query.dto";
import {
  CreateResearchTreeCountBody,
  ResearchTreeCountDto,
  UpdateResearchTreeCountBody
} from "./dto/research-tree-count.dto";
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

  @Post()
  @ApiOperation({
    operationId: "researchTreeCountCreate",
    summary: "Create the research tree count for a project"
  })
  @JsonApiResponse(ResearchTreeCountDto)
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to create tree counts" })
  @ExceptionResponse(BadRequestException, {
    description: "Payload malformed, project not found, or the project already has a tree count"
  })
  async create(@Body() payload: CreateResearchTreeCountBody) {
    await this.policyService.authorize("create", ResearchTreeCount);
    const treeCount = await this.researchTreeCountsService.create(payload.data.attributes);
    return buildJsonApi(ResearchTreeCountDto).addData(treeCount.project.uuid, new ResearchTreeCountDto(treeCount));
  }

  @Patch(":projectUuid")
  @ApiOperation({
    operationId: "researchTreeCountUpdate",
    summary: "Update the research tree count for a project"
  })
  @ApiParam({ name: "projectUuid", type: String, format: "uuid" })
  @JsonApiResponse(ResearchTreeCountDto)
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to update this tree count" })
  @ExceptionResponse(NotFoundException, { description: "Tree count not found for this project" })
  @ExceptionResponse(BadRequestException, { description: "Payload malformed, or path and payload ids do not match" })
  async update(@Param("projectUuid") projectUuid: string, @Body() payload: UpdateResearchTreeCountBody) {
    if (payload.data.id !== projectUuid) {
      throw new BadRequestException("Tree count id in path and payload do not match");
    }
    const treeCount = await this.researchTreeCountsService.findByProjectUuid(projectUuid);
    await this.policyService.authorize("update", treeCount);
    const updated = await this.researchTreeCountsService.update(treeCount, payload.data.attributes);
    return buildJsonApi(ResearchTreeCountDto).addData(projectUuid, new ResearchTreeCountDto(updated));
  }

  @Delete(":projectUuid")
  @ApiOperation({
    operationId: "researchTreeCountDelete",
    summary: "Delete the research tree count for a project"
  })
  @ApiParam({ name: "projectUuid", type: String, format: "uuid" })
  @JsonApiDeletedResponse(getDtoType(ResearchTreeCountDto), { description: "Tree count was deleted" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to delete this tree count" })
  @ExceptionResponse(NotFoundException, { description: "Tree count not found for this project" })
  async delete(@Param("projectUuid") projectUuid: string) {
    const treeCount = await this.researchTreeCountsService.findByProjectUuid(projectUuid);
    await this.policyService.authorize("delete", treeCount);
    await this.researchTreeCountsService.delete(treeCount);
    return buildDeletedResponse(getDtoType(ResearchTreeCountDto), projectUuid);
  }
}
