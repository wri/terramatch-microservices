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
import { OrganisationCreateBody } from "./dto/organisation-create.dto";
import { OrganisationUpdateBody } from "./dto/organisation-update.dto";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { OrganisationFullDto, OrganisationLightDto, UserDto } from "@terramatch-microservices/common/dto";
import { PolicyService } from "@terramatch-microservices/common";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { USER_ORG_RELATIONSHIP } from "../users/users.controller";
import { OrganisationCreationService } from "./organisation-creation.service";
import { ApiOperation } from "@nestjs/swagger";
import {
  buildDeletedResponse,
  buildJsonApi,
  getStableRequestQuery,
  getDtoType
} from "@terramatch-microservices/common/util";
import {
  Organisation,
  FinancialIndicator,
  FinancialReport,
  Media,
  FundingType
} from "@terramatch-microservices/database/entities";
import { OrganisationIndexQueryDto } from "./dto/organisation-query.dto";
import { OrganisationShowQueryDto } from "./dto/organisation-show-query.dto";
import { OrganisationsService } from "./organisations.service";
import { FinancialIndicatorDto } from "@terramatch-microservices/common/dto/financial-indicator.dto";
import { EmbeddedMediaDto, MediaDto } from "@terramatch-microservices/common/dto/media.dto";
import { FundingTypeDto } from "@terramatch-microservices/common/dto/funding-type.dto";
import { FinancialReportLightDto } from "@terramatch-microservices/common/dto/financial-report.dto";

@Controller("organisations/v3/organisations")
export class OrganisationsController {
  constructor(
    private readonly policyService: PolicyService,
    private readonly organisationsService: OrganisationsService,
    private readonly organisationCreationService: OrganisationCreationService,
    private readonly mediaService: MediaService
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
    const { organisations, paginationTotal } = await this.organisationsService.findMany(query);

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
  @JsonApiResponse({
    data: OrganisationFullDto,
    included: [FinancialIndicatorDto, FinancialReportLightDto, MediaDto, FundingTypeDto]
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed, or resource unavailable to current user."
  })
  @ExceptionResponse(NotFoundException, { description: "Resource not found." })
  async show(@Param("uuid") uuid: string, @Query() query: OrganisationShowQueryDto) {
    const organisation = await this.organisationsService.findOne(uuid);
    await this.policyService.authorize("read", organisation);

    const document = buildJsonApi(OrganisationFullDto).addData(
      organisation.uuid,
      new OrganisationFullDto(organisation)
    ).document;

    if (query.sideloads?.includes("financialCollection")) {
      const financialIndicators = await FinancialIndicator.organisation(organisation.id).findAll();

      if (financialIndicators.length > 0) {
        const mediaCollection = await Media.for(financialIndicators).findAll({
          where: { collectionName: "documentation" }
        });

        const mediaByIndicatorId = mediaCollection.reduce((acc, media) => {
          if (acc[media.modelId] == null) {
            acc[media.modelId] = [];
          }
          acc[media.modelId].push(media);
          return acc;
        }, {} as Record<number, Media[]>);

        for (const indicator of financialIndicators) {
          const indicatorMedia = mediaByIndicatorId[indicator.id] ?? [];
          const mediaDtos =
            indicatorMedia.length > 0
              ? indicatorMedia.map(
                  media =>
                    new EmbeddedMediaDto(media, {
                      url: this.mediaService.getUrl(media),
                      thumbUrl: this.mediaService.getUrl(media, "thumbnail")
                    })
                )
              : null;

          const indicatorDto = new FinancialIndicatorDto(indicator, {
            entityType: "financialIndicators" as const,
            entityUuid: indicator.uuid,
            documentation: mediaDtos
          });
          Object.assign(indicatorDto, { organisationUuid: organisation.uuid });
          document.addData(indicator.uuid, indicatorDto);
        }
      }
    }

    if (query.sideloads?.includes("financialReport")) {
      const financialReports = await FinancialReport.organisation(organisation.id).findAll();

      if (financialReports.length > 0) {
        for (const report of financialReports) {
          const dto = new FinancialReportLightDto(report, {
            entityType: "financialReports" as const,
            entityUuid: report.uuid
          });
          dto.organisationUuid = organisation.uuid;
          document.addData(report.uuid, dto);
        }
      }
    }

    if (query.sideloads?.includes("media")) {
      const allMedia = await Media.for(organisation).findAll();

      if (allMedia.length > 0) {
        for (const media of allMedia) {
          document.addData(
            media.uuid,
            new MediaDto(media, {
              entityType: "organisations" as const,
              entityUuid: organisation.uuid,
              url: this.mediaService.getUrl(media),
              thumbUrl: this.mediaService.getUrl(media, "thumbnail")
            })
          );
        }
      }
    }

    if (query.sideloads?.includes("fundingTypes")) {
      const fundingTypes = await FundingType.organisation(organisation.uuid).findAll();

      if (fundingTypes.length > 0) {
        for (const fundingType of fundingTypes) {
          document.addData(
            fundingType.uuid,
            new FundingTypeDto(fundingType, {
              // @ts-expect-error - fundingTypes is not in AssociationEntityType but is valid for JSON:API
              entityType: "fundingTypes" as const,
              entityUuid: fundingType.uuid
            })
          );
        }
      }
    }

    return document;
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
    description: "Create a new organisation, and the first user for it."
  })
  @JsonApiResponse({
    data: OrganisationLightDto,
    included: [{ type: UserDto, relationships: [USER_ORG_RELATIONSHIP] }]
  })
  @ExceptionResponse(UnauthorizedException, { description: "Organisation creation not allowed." })
  @ExceptionResponse(BadRequestException, { description: "One or more attributes are invalid or missing." })
  async create(@Body() payload: OrganisationCreateBody) {
    await this.policyService.authorize("create", Organisation);

    const { user, organisation } = await this.organisationCreationService.createOrganisation(payload.data.attributes);

    const document = buildJsonApi(OrganisationLightDto);
    const orgResource = document.addData(organisation.uuid, new OrganisationLightDto(organisation));
    const userResource = document.addData(user.uuid ?? "no-uuid", new UserDto(user, await user.myFrameworks()));
    userResource.relateTo("org", orgResource, { meta: { userStatus: "na" } });
    return document;
  }
}
