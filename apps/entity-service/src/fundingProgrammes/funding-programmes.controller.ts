import {
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
import { SingleResourceDto } from "@terramatch-microservices/common/dto/single-resource.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { Form, FundingProgramme, Organisation, Stage, User } from "@terramatch-microservices/database/entities";
import { ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import {
  CreateFundingProgrammeBody,
  FundingProgrammeDto,
  UpdateFundingProgrammeBody
} from "./dto/funding-programme.dto";
import {
  buildDeletedResponse,
  buildJsonApi,
  getDtoType,
  getStableRequestQuery
} from "@terramatch-microservices/common/util";
import { FundingProgrammeQueryDto } from "./dto/funding-programme-query.dto";
import { authenticatedUserId } from "@terramatch-microservices/common/guards/auth.guard";
import { FormDataService } from "../entities/form-data.service";
import { difference, uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { literal, Op } from "sequelize";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { ApplicationDto } from "../applications/dto/application.dto";
import { BadRequestException } from "@nestjs/common/exceptions/bad-request.exception";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";

@Controller("fundingProgrammes/v3/fundingProgrammes")
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
      requestPath: `/fundingProgrammes/v3/fundingProgrammes${getStableRequestQuery(query)}`
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
    const attributes = payload.data.attributes;
    const fundingProgramme = FundingProgramme.build({
      name: attributes.name,
      nameId: await this.localizationService.generateI18nId(attributes.name),
      description: attributes.description,
      descriptionId: await this.localizationService.generateI18nId(attributes.description),
      location: attributes.location,
      locationId: await this.localizationService.generateI18nId(attributes.location),
      readMoreUrl: attributes.readMoreUrl,
      status: attributes.status,
      frameworkKey: attributes.frameworkKey,
      organisationTypes: attributes.organisationTypes
    });
    // authorize creation before saving the built model
    await this.policyService.authorize("create", fundingProgramme);
    await fundingProgramme.save();

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

  // Using PUT instead of PATCH because if a stage is left out of the attributes, it is removed from
  // the funding programme. PUT is the correct method for this mechanic.
  @Put(":uuid")
  @ApiOperation({ operationId: "fundingProgrammeUpdate", description: "Update a funding programme" })
  @JsonApiResponse(FundingProgrammeDto)
  @ExceptionResponse(UnauthorizedException, { description: "Funding Programme update not allowed." })
  @ExceptionResponse(BadRequestException, { description: "Funding Programme payload malformed." })
  @ExceptionResponse(NotFoundException, { description: "Funding Programme not found." })
  async updateFundingProgramme(@Param() { uuid }: SingleResourceDto, @Body() payload: UpdateFundingProgrammeBody) {
    if (uuid !== payload.data.id) {
      throw new BadRequestException("Funding programme id in path and payload do not match");
    }

    const fundingProgramme = await FundingProgramme.findOne({ where: { uuid } });
    if (fundingProgramme == null) throw new NotFoundException("Funding programme not found");

    await this.policyService.authorize("update", fundingProgramme);

    const attributes = payload.data.attributes;
    await fundingProgramme.update({
      name: attributes.name,
      nameId:
        attributes.name === fundingProgramme.name
          ? fundingProgramme.nameId
          : await this.localizationService.generateI18nId(attributes.name),
      description: attributes.description,
      descriptionId:
        attributes.description === fundingProgramme.description
          ? fundingProgramme.descriptionId
          : await this.localizationService.generateI18nId(attributes.description),
      location: attributes.location,
      locationId:
        attributes.location === fundingProgramme.location
          ? fundingProgramme.locationId
          : await this.localizationService.generateI18nId(attributes.location),
      readMoreUrl: attributes.readMoreUrl,
      status: attributes.status,
      frameworkKey: attributes.frameworkKey,
      organisationTypes: attributes.organisationTypes
    });

    const currentStages = await Stage.findAll({ where: { fundingProgrammeId: fundingProgramme.uuid } });
    const updateStages = await Promise.all(
      (attributes.stages ?? []).map(async ({ uuid, name, deadlineAt, formUuid }, index) => {
        const stage = currentStages.find(stage => stage.uuid === uuid) ?? new Stage();
        stage.fundingProgrammeId = fundingProgramme.uuid;
        stage.name = name ?? null;
        stage.deadlineAt = deadlineAt ?? null;
        stage.order = index + 1;
        await stage.save();

        const form = await Form.findOne({ where: { stageId: stage.uuid }, attributes: ["id", "uuid"] });
        // If the currently assigned form is no longer correct, unassign stage from that form
        if (form != null && formUuid !== form.uuid) await form.update({ stageId: null });
        // If a form UUID is assigned and it doesn't match what was found for this stage, assign it.
        if (formUuid != null && (form == null || form.uuid !== formUuid)) {
          await Form.update(
            {
              stageId: stage.uuid,
              frameworkKey: fundingProgramme.frameworkKey
            },
            { where: { uuid: formUuid } }
          );
        }

        return stage;
      })
    );

    const currentUuids = currentStages.map(({ uuid }) => uuid);
    const updateUuids = updateStages.map(({ uuid }) => uuid);
    const removed = difference(currentUuids, updateUuids);
    if (removed.length > 0) {
      await Stage.destroy({ where: { uuid: removed } });
      await Form.update({ stageId: null }, { where: { stageId: removed } });
    }

    return await this.formDataService.addFundingProgrammeDtos(buildJsonApi(FundingProgrammeDto), [fundingProgramme]);
  }
}
