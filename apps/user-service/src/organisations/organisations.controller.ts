import {
  BadRequestException,
  Body,
  ConflictException,
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
import { OrganisationCreateBody } from "./dto/organisation-create.dto";
import { OrganisationUpdateBody } from "./dto/organisation-update.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { OrganisationFullDto, OrganisationLightDto } from "@terramatch-microservices/common/dto";
import { PolicyService } from "@terramatch-microservices/common";
import { ApiOperation } from "@nestjs/swagger";
import {
  buildDeletedResponse,
  buildJsonApi,
  getStableRequestQuery,
  getDtoType
} from "@terramatch-microservices/common/util";
import { Organisation } from "@terramatch-microservices/database/entities";
import { OrganisationIndexQueryDto } from "./dto/organisation-query.dto";
import { OrganisationsService } from "./organisations.service";

@Controller("organisations/v3/organisations")
export class OrganisationsController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly organisationsService: OrganisationsService
  ) {}

  @Get()
  @ApiOperation({ operationId: "organisationIndex" })
  @JsonApiResponse([
    { data: OrganisationLightDto, pagination: "number" },
    { data: OrganisationFullDto, pagination: "number" }
  ])
  @ExceptionResponse(UnauthorizedException, { description: "Organisation listing not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Query params are invalid" })
  async index(@Query() query: OrganisationIndexQueryDto) {
    const permissions = await this.policyService.getPermissions();
    const isAdmin = permissions.some(p => p.startsWith("framework-")) || permissions.includes("users-manage");

    const { organisations, paginationTotal } = await this.organisationsService.findMany(query, isAdmin);

    await this.policyService.authorize("read", organisations);

    const dtoType = query.lightResource === true ? OrganisationLightDto : OrganisationFullDto;

    return organisations.reduce(
      (document, org) => {
        const dto = query.lightResource === true ? new OrganisationLightDto(org) : new OrganisationFullDto(org);
        return document.addData(org.uuid, dto).document;
      },
      buildJsonApi(dtoType, { forceDataArray: true }).addIndex({
        requestPath: `/organisations/v3/organisations${getStableRequestQuery(query)}`,
        total: paginationTotal,
        pageNumber: query.page?.number ?? 1
      })
    );
  }

  @Get(":uuid")
  @ApiOperation({ operationId: "organisationShow", summary: "Get a single organisation by UUID" })
  @JsonApiResponse({ data: OrganisationFullDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async show(@Param("uuid") uuid: string) {
    const organisation = await this.organisationsService.findOne(uuid);
    await this.policyService.authorize("read", organisation);
    return buildJsonApi(OrganisationFullDto).addData(organisation.uuid, new OrganisationFullDto(organisation));
  }

  @Patch(":uuid")
  @ApiOperation({
    operationId: "organisationUpdate",
    summary: "Update organisation fields directly"
  })
  @JsonApiResponse({ data: OrganisationFullDto })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  @ExceptionResponse(BadRequestException, { description: "Request params are malformed." })
  async update(@Param("uuid") uuid: string, @Body() updatePayload: OrganisationUpdateBody) {
    if (uuid !== updatePayload.data.id) {
      throw new BadRequestException("Entity id in path and payload do not match");
    }

    const organisation = await this.organisationsService.findOne(uuid);
    await this.policyService.authorize("update", organisation);

    await this.organisationsService.update(organisation, updatePayload.data.attributes);

    return buildJsonApi(OrganisationFullDto).addData(organisation.uuid, new OrganisationFullDto(organisation));
  }

  @Delete(":uuid")
  @ApiOperation({
    operationId: "organisationDelete",
    summary: "Soft delete organisation resource by UUID"
  })
  @JsonApiDeletedResponse(getDtoType(OrganisationFullDto), {
    description: "Associated organisation was deleted"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async delete(@Param("uuid") uuid: string) {
    const organisation = await this.organisationsService.findOne(uuid);
    await this.policyService.authorize("delete", organisation);
    await this.organisationsService.delete(organisation);
    return buildDeletedResponse(getDtoType(OrganisationFullDto), organisation.uuid);
  }

  @Post()
  @ApiOperation({
    operationId: "organisationCreation",
    description: "Create a new organisation for the authenticated user."
  })
  @JsonApiResponse({
    data: OrganisationLightDto
  })
  @ExceptionResponse(UnauthorizedException, { description: "Organisation creation not allowed." })
  @ExceptionResponse(ConflictException, { description: "User already has an organisation." })
  @ExceptionResponse(BadRequestException, { description: "One or more attributes are invalid or missing." })
  async create(@Body() payload: OrganisationCreateBody) {
    await this.policyService.authorize("create", Organisation);

    const { organisation } = await this.organisationsService.create(payload.data.attributes);

    return buildJsonApi(OrganisationLightDto).addData(organisation.uuid, new OrganisationLightDto(organisation));
  }
}
