import { Controller, Get, NotFoundException, Param, Query, UnauthorizedException } from "@nestjs/common";
import { ApiOperation, ApiParam } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { PolicyService } from "@terramatch-microservices/common";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { ReportingFrameworkDto } from "./dto/reporting-framework.dto";
import { ReportingFrameworksService } from "./reporting-frameworks.service";
import { ReportingFrameworkQueryDto } from "./dto/reporting-framework-query.dto";

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
