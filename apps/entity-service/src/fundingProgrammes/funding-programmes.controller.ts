import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { Form, FundingProgramme, Organisation, Stage, User } from "@terramatch-microservices/database/entities";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { CreateFundingProgrammeBody, FundingProgrammeDto } from "./dto/funding-programme.dto";
import {
  buildDeletedResponse,
  buildJsonApi,
  getDtoType,
  getStableRequestQuery
} from "@terramatch-microservices/common/util";
import { FundingProgrammeQueryDto } from "./dto/funding-programme-query.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { FormDataService } from "../entities/form-data.service";
import { uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { literal, Op } from "sequelize";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { ApplicationDto } from "../applications/dto/application.dto";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

@Controller("fundingProgrammes/v3")
export class FundingProgrammesController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly formDataService: FormDataService,
    private readonly localizationService: LocalizationService
  ) {}

  @Get()
  @ApiOperation({
    operationId: "fundingProgrammesIndex",
    summary: "Get all funding programmes"
  })
  @JsonApiResponse({ data: FundingProgrammeDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, {
    description: "User is not authorized to access these funding programmes"
  })
  async indexFundingProgrammes(@Query() query: FundingProgrammeQueryDto) {
    const permissions = await this.policyService.getPermissions();
    let fundingProgrammes: FundingProgramme[];
    if (permissions.find(p => p.startsWith("framework-")) == null) {
      // non-admins only have access to FPs that match their org types
      const orgUuids = await User.orgUuids(authenticatedUserId());
      const types =
        orgUuids.length === 0
          ? []
          : uniq(
              (
                await Organisation.findAll({
                  where: { uuid: orgUuids },
                  attributes: ["type"]
                })
              ).map(({ type }) => type)
            ).filter(isNotNull);
      fundingProgrammes =
        types.length === 0
          ? []
          : await FundingProgramme.findAll({
              // It's unclear why, but sequelize is failing to generate an appropriate like query here
              where: { [Op.or]: types.map(type => literal(`organisation_types like '%"${type}"%'`)) }
            });
    } else {
      // admins have access to everything
      fundingProgrammes = await FundingProgramme.findAll();
    }

    const locale = query.translated === false ? undefined : await User.findLocale(authenticatedUserId());
    await this.policyService.authorize("read", fundingProgrammes);
    const document = buildJsonApi(FundingProgrammeDto, { forceDataArray: true }).addIndex({
      requestPath: `/fundingProgrammes/v3${getStableRequestQuery(query)}`
    });
    return await this.formDataService.addFundingProgrammeDtos(document, fundingProgrammes, locale);
  }

  @Get(":uuid")
  @ApiOperation({
    operationId: "fundingProgrammeGet",
    summary: "Get a single funding programme by UUID"
  })
  @JsonApiResponse(FundingProgrammeDto)
  @ExceptionResponse(NotFoundException, { description: "Funding programme not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to access this funding programme" })
  async getFundingProgramme(@Param() { uuid }: SingleResourceDto, @Query() { translated }: FundingProgrammeQueryDto) {
    const fundingProgramme = await FundingProgramme.findOne({ where: { uuid } });
    if (fundingProgramme == null) throw new NotFoundException("Funding programme not found");

    const locale = translated === false ? undefined : await User.findLocale(authenticatedUserId());
    await this.policyService.authorize("read", fundingProgramme);

    return await this.formDataService.addFundingProgrammeDtos(
      buildJsonApi(FundingProgrammeDto),
      [fundingProgramme],
      locale
    );
  }

  @Delete(":uuid")
  @ApiOperation({ operationId: "fundingProgrammeDelete", summary: "Delete a funding programme by UUID" })
  @JsonApiDeletedResponse(getDtoType(ApplicationDto), { description: "Funding programme was deleted" })
  @ExceptionResponse(NotFoundException, { description: "Funding programme not found" })
  @ExceptionResponse(UnauthorizedException, { description: "User is not authorized to delete this funding programme" })
  async deleteFundingProgramme(@Param() { uuid }: SingleResourceDto) {
    const fundingProgramme = await FundingProgramme.findOne({ where: { uuid }, attributes: ["id"] });
    if (fundingProgramme == null) throw new NotFoundException("Funding programme not found");

    await this.policyService.authorize("delete", fundingProgramme);

    await fundingProgramme.destroy();
    return buildDeletedResponse(getDtoType(FundingProgrammeDto), uuid);
  }

  @Post()
  @ApiOperation({ operationId: "fundingProgrammeCreate", description: "Create a new funding programme" })
  @JsonApiResponse(FundingProgrammeDto)
  @ExceptionResponse(UnauthorizedException, { description: "Funding programme creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Funding programme payload malformed." })
  async createFundingProgramme(@Body() payload: CreateFundingProgrammeBody) {
    await this.policyService.authorize("create", FundingProgramme);

    const attributes = payload.data.attributes;
    const fundingProgramme = await FundingProgramme.create({
      name: attributes.name,
      nameId: await this.localizationService.generateI18nId(attributes.name),
      description: attributes.description,
      descriptionId: await this.localizationService.generateI18nId(attributes.description),
      location: attributes.location,
      locationId: await this.localizationService.generateI18nId(attributes.location),
      readMoreUrl: attributes.readMoreUrl,
      status: attributes.status,
      frameworkKey: attributes.framework,
      organisationTypes: attributes.organisationTypes
    });

    await Promise.all(
      (attributes.stages ?? []).map(async ({ name, deadlineAt, formUuid }, index) => {
        const stage = await Stage.create({
          fundingProgrammeId: fundingProgramme.uuid,
          name,
          deadlineAt,
          order: index + 1
        });
        if (formUuid != null) {
          await Form.update(
            {
              stageId: stage.uuid,
              frameworkKey: fundingProgramme.frameworkKey
            },
            { where: { uuid: formUuid } }
          );
        }
      })
    );

    return await this.formDataService.addFundingProgrammeDtos(buildJsonApi(FundingProgrammeDto), [fundingProgramme]);
  }
}
