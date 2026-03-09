import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { PolicyService } from "@terramatch-microservices/common";
import {
  buildDeletedResponse,
  buildJsonApi,
  getDtoType,
  getStableRequestQuery
} from "@terramatch-microservices/common/util";
import { Framework } from "@terramatch-microservices/database/entities";
import {
  CreateReportingFrameworkBody,
  ReportingFrameworkDto,
  UpdateReportingFrameworkBody
} from "./dto/reporting-framework.dto";
import { ReportingFrameworksService, reportingFrameworkSlugFromName } from "./reporting-frameworks.service";
import { ReportingFrameworkQueryDto } from "./dto/reporting-framework-query.dto";
import { FrameworkKey } from "@terramatch-microservices/database/constants";

@Controller("reportingFrameworks/v3/reportingFrameworks")
export class ReportingFrameworksController {
  constructor(
    private readonly reportingFrameworksService: ReportingFrameworksService,
    private readonly policyService: PolicyService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "reportingFrameworksIndex",
    summary: "Get all reporting frameworks (admin only)"
  })
  @JsonApiResponse({ data: ReportingFrameworkDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, {
    description: "User is not authorized to access reporting frameworks"
  })
  async index(@Query() query: ReportingFrameworkQueryDto) {
    const frameworks = await this.reportingFrameworksService.findAll();
    await this.policyService.authorize("read", frameworks);

    const document = buildJsonApi(ReportingFrameworkDto, { forceDataArray: true }).addIndex({
      requestPath: `/reportingFrameworks/v3/reportingFrameworks${getStableRequestQuery(query)}`
    });

    return await this.reportingFrameworksService.addDtos(document, frameworks);
  }

  @Post()
  @ApiOperation({
    operationId: "reportingFrameworkCreate",
    summary: "Create a reporting framework (admin only)"
  })
  @JsonApiResponse(ReportingFrameworkDto)
  @ExceptionResponse(UnauthorizedException, { description: "Reporting framework creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Reporting framework payload malformed." })
  async create(@Body() payload: CreateReportingFrameworkBody) {
    const attributes = payload.data.attributes;
    const built = Framework.build({
      name: attributes.name,
      slug: reportingFrameworkSlugFromName(attributes.name) as FrameworkKey
    });
    await this.policyService.authorize("create", built);
    const framework = await this.reportingFrameworksService.create(attributes);
    return await this.reportingFrameworksService.addDto(buildJsonApi(ReportingFrameworkDto), framework);
  }

  @Put(":frameworkKey")
  @ApiOperation({
    operationId: "reportingFrameworkUpdate",
    summary: "Update a reporting framework by framework key (slug) (admin only)"
  })
  @ApiParam({ name: "frameworkKey", type: String, description: "Framework slug/key" })
  @JsonApiResponse(ReportingFrameworkDto)
  @ExceptionResponse(NotFoundException, { description: "Reporting framework not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Reporting framework update not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Payload id must match path frameworkKey." })
  async update(@Param("frameworkKey") frameworkKey: string, @Body() payload: UpdateReportingFrameworkBody) {
    if (payload.data.id != null && payload.data.id !== frameworkKey) {
      throw new BadRequestException("Reporting framework id in path and payload do not match");
    }
    const framework = await this.reportingFrameworksService.findBySlug(frameworkKey);
    await this.policyService.authorize("update", framework);
    const updated = await this.reportingFrameworksService.update(framework, payload.data.attributes);
    return await this.reportingFrameworksService.addDto(buildJsonApi(ReportingFrameworkDto), updated);
  }

  @Delete(":frameworkKey")
  @ApiOperation({
    operationId: "reportingFrameworkDelete",
    summary: "Delete a reporting framework by framework key (slug) (admin only)"
  })
  @ApiParam({ name: "frameworkKey", type: String, description: "Framework slug/key" })
  @ExceptionResponse(NotFoundException, { description: "Reporting framework not found" })
  @ExceptionResponse(UnauthorizedException, { description: "Reporting framework delete not allowed." })
  async delete(@Param("frameworkKey") frameworkKey: string) {
    const framework = await this.reportingFrameworksService.findBySlug(frameworkKey);
    await this.policyService.authorize("delete", framework);
    await this.reportingFrameworksService.delete(framework);
    return buildDeletedResponse(getDtoType(ReportingFrameworkDto), frameworkKey);
  }

  @Get(":frameworkKey")
  @ApiOperation({
    operationId: "reportingFrameworkGet",
    summary: "Get a single reporting framework by framework key (slug)"
  })
  @ApiParam({ name: "frameworkKey", type: String, description: "Framework slug/key" })
  @JsonApiResponse(ReportingFrameworkDto)
  @ExceptionResponse(NotFoundException, { description: "Reporting framework not found" })
  @ExceptionResponse(UnauthorizedException, {
    description: "User is not authorized to access this reporting framework"
  })
  async get(@Param("frameworkKey") frameworkKey: string) {
    const framework = await this.reportingFrameworksService.findBySlug(frameworkKey);
    await this.policyService.authorize("read", framework);

    return await this.reportingFrameworksService.addDto(buildJsonApi(ReportingFrameworkDto), framework);
  }
}
