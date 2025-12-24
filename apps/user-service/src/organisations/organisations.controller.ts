import { BadRequestException, Body, Controller, Get, Post, Query, UnauthorizedException } from "@nestjs/common";
import { OrganisationCreateBody } from "./dto/organisation-create.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { OrganisationDto, UserDto } from "@terramatch-microservices/common/dto";
import { USER_ORG_RELATIONSHIP } from "../users/users.controller";
import { PolicyService } from "@terramatch-microservices/common";
import { OrganisationCreationService } from "./organisation-creation.service";
import { ApiOperation } from "@nestjs/swagger";
import { buildJsonApi, getStableRequestQuery } from "@terramatch-microservices/common/util";
import { Organisation } from "@terramatch-microservices/database/entities";
import { OrganisationIndexQueryDto } from "./dto/organisation-query.dto";
import { Op } from "sequelize";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";

@Controller("organisations/v3/organisations")
export class OrganisationsController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly organisationCreationService: OrganisationCreationService
  ) {}

  // Note: this endpoint is not complete; it is a stub for supporting the applied orgs tab on
  // funding programmes until the full org resource endpoints are ported from v2.
  @Get()
  @ApiOperation({ operationId: "organisationIndex" })
  @JsonApiResponse({ data: OrganisationDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, { description: "Organisation listing not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Query params are invalid" })
  async index(@Query() query: OrganisationIndexQueryDto) {
    if (query.fundingProgrammeUuid == null) {
      // this is the only thing supported for now, and is required.
      throw new BadRequestException("Funding programme UUID is required");
    }

    const builder = PaginatedQueryBuilder.forNumberPage(Organisation, query.page);
    builder.where({
      uuid: { [Op.in]: Organisation.uuidForFundingProgramme(query.fundingProgrammeUuid) }
    });
    const orgs = await builder.execute();

    await this.policyService.authorize("read", orgs);

    return orgs.reduce(
      (document, org) => document.addData(org.uuid, new OrganisationDto(org)).document,
      buildJsonApi(OrganisationDto, { forceDataArray: true }).addIndex({
        requestPath: `/organisations/v3${getStableRequestQuery(query)}`,
        total: await builder.paginationTotal(),
        pageNumber: query.page?.number ?? 1
      })
    );
  }

  @Post()
  @ApiOperation({
    operationId: "organisationCreation",
    description: "Create a new organisation, and the first user for it."
  })
  @JsonApiResponse({
    data: OrganisationDto,
    included: [{ type: UserDto, relationships: [USER_ORG_RELATIONSHIP] }]
  })
  @ExceptionResponse(UnauthorizedException, { description: "Organisation creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "One or more attributes are invalid or missing." })
  async create(@Body() payload: OrganisationCreateBody) {
    await this.policyService.authorize("create", Organisation);

    const { user, organisation } = await this.organisationCreationService.createOrganisation(payload.data.attributes);

    const document = buildJsonApi(OrganisationDto);
    const orgResource = document.addData(organisation.uuid, new OrganisationDto(organisation));
    const userResource = document.addData(user.uuid ?? "no-uuid", new UserDto(user, await user.myFrameworks()));
    userResource.relateTo("org", orgResource, { meta: { userStatus: "na" } });
    return document;
  }
}
