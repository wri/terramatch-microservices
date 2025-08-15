import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { buildJsonApi, buildDeletedResponse, getDtoType } from "@terramatch-microservices/common/util";
import { PolicyService } from "@terramatch-microservices/common";
import { FinancialReportFullDto, FinancialReportLightDto } from "./dto/financial-report.dto";
import { EntityQueryDto } from "./dto/entity-query.dto";
import { EntityUpdateBody } from "./dto/entity-update.dto";
import { EntitiesService } from "./entities.service";

@Controller("entities/v3/financial-reports")
export class FinancialReportsController {
  constructor(private readonly policyService: PolicyService, private readonly entitiesService: EntitiesService) {}

  @Get()
  @ApiOperation({
    operationId: "financialReportsIndex",
    summary: "Get a paginated and filtered list of financial report resources."
  })
  @JsonApiResponse([{ data: FinancialReportLightDto, pagination: "number" }])
  @ExceptionResponse(BadRequestException, { description: "Query params invalid" })
  async index(@Query() query: EntityQueryDto) {
    const processor = this.entitiesService.createFinancialReportProcessor();
    const document = buildJsonApi(processor.LIGHT_DTO, { pagination: "number" });
    await processor.addIndex(document, query);
    return document.serialize();
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "financialReportShow",
    summary: "Get a specific financial report by UUID."
  })
  @JsonApiResponse([{ data: FinancialReportFullDto }])
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async show(@Param("uuid") uuid: string) {
    const processor = this.entitiesService.createFinancialReportProcessor();
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();

    await this.policyService.authorize("read", model);

    const document = buildJsonApi(processor.FULL_DTO);
    const { id, dto } = await processor.getFullDto(model);
    document.addData(id, dto);
    return document.serialize();
  }

  @Patch(":uuid")
  @ApiOperation({
    operationId: "financialReportUpdate",
    summary: "Update financial report fields directly."
  })
  @JsonApiResponse([{ data: FinancialReportFullDto }])
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  @ExceptionResponse(BadRequestException, { description: "Request params are malformed." })
  async update(@Param("uuid") uuid: string, @Body() updatePayload: EntityUpdateBody) {
    if (updatePayload.data.type !== "financial-reports") {
      throw new BadRequestException("Entity type in payload does not match financial-reports");
    }
    if (uuid !== updatePayload.data.id) {
      throw new BadRequestException("Entity id in path and payload do not match");
    }

    const processor = this.entitiesService.createFinancialReportProcessor();
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();

    await this.policyService.authorize("update", model);

    await processor.update(model, updatePayload.data.attributes);

    const document = buildJsonApi(processor.FULL_DTO);
    const { id, dto } = await processor.getFullDto(model);
    document.addData(id, dto);
    return document.serialize();
  }

  @Delete(":uuid")
  @ApiOperation({
    operationId: "financialReportDelete",
    summary: "Delete a financial report."
  })
  @JsonApiDeletedResponse(getDtoType(FinancialReportFullDto))
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async delete(@Param("uuid") uuid: string) {
    const processor = this.entitiesService.createFinancialReportProcessor();
    const model = await processor.findOne(uuid);
    if (model == null) throw new NotFoundException();

    await this.policyService.authorize("delete", model);

    await model.destroy();

    return buildDeletedResponse(getDtoType(processor.FULL_DTO), model.uuid);
  }
}
