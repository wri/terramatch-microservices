import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UnauthorizedException
} from "@nestjs/common";
import {
  buildDeletedResponse,
  buildJsonApi,
  getDtoType,
  getStableRequestQuery,
  IndexData
} from "@terramatch-microservices/common/util";
import { ApiExtraModels, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { JsonApiDeletedResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { SitePolygonFullDto, SitePolygonLightDto } from "./dto/site-polygon.dto";
import { SitePolygonQueryDto } from "./dto/site-polygon-query.dto";
import {
  IndicatorFieldMonitoringDto,
  IndicatorHectaresDto,
  IndicatorMsuCarbonDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorTreeCoverLossDto
} from "./dto/indicators.dto";
import { SitePolygonBulkUpdateBodyDto } from "./dto/site-polygon-update.dto";
import { SitePolygonsService } from "./site-polygons.service";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { SitePolygonVersioningService } from "./site-polygon-versioning.service";
import { PolicyService } from "@terramatch-microservices/common";
import { SitePolygon, User } from "@terramatch-microservices/database/entities";
import { isNumberPage } from "@terramatch-microservices/common/dto/page.dto";
import {
  CreateSitePolygonBatchRequestDto,
  CreateSitePolygonJsonApiRequestDto
} from "./dto/create-site-polygon-request.dto";
import { ValidationDto } from "../validations/dto/validation.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { VersionUpdateBody } from "./dto/version-update.dto";

const MAX_PAGE_SIZE = 100 as const;

@Controller("research/v3/sitePolygons")
@ApiExtraModels(
  IndicatorTreeCoverLossDto,
  IndicatorHectaresDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorFieldMonitoringDto,
  IndicatorMsuCarbonDto,
  ValidationDto
)
export class SitePolygonsController {
  constructor(
    private readonly sitePolygonService: SitePolygonsService,
    private readonly sitePolygonCreationService: SitePolygonCreationService,
    private readonly versioningService: SitePolygonVersioningService,
    private readonly policyService: PolicyService
  ) {}

  private readonly logger = new Logger(SitePolygonsController.name);

  @Post()
  @ApiOperation({
    operationId: "createSitePolygons",
    summary: "Create site polygons from GeoJSON or create version from existing",
    description: `Create site polygons OR create a new version of an existing polygon.
    **Normal Creation**: Provide geometries array with site_id in properties.
    **Version Creation**: Provide baseSitePolygonUuid + changeReason + (geometries and/or attributeChanges).
    Duplicate validation results are always included in the response when duplicates are found.`
  })
  @JsonApiResponse([SitePolygonLightDto])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid request data, site not found, or versioning validation failed."
  })
  async create(@Body() createRequest: CreateSitePolygonJsonApiRequestDto) {
    await this.policyService.authorize("create", SitePolygon);

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const user = await User.findByPk(userId, {
      include: [{ association: "roles", attributes: ["name"] }]
    });
    const source = user?.getSourceFromRoles() ?? "terramatch";
    const userFullName = user?.fullName ?? null;

    const baseSitePolygonUuid = createRequest?.data?.attributes?.baseSitePolygonUuid;
    const changeReason = createRequest?.data?.attributes?.changeReason;
    const attributeChanges = createRequest?.data?.attributes?.attributeChanges;
    const geometries = createRequest?.data?.attributes?.geometries;

    if (baseSitePolygonUuid != null && baseSitePolygonUuid.length > 0) {
      return this.createVersion(
        baseSitePolygonUuid,
        geometries,
        attributeChanges,
        changeReason ?? "Version created via API",
        userId,
        userFullName,
        source
      );
    }

    if (geometries == null || geometries.length === 0) {
      throw new BadRequestException(
        "geometries array is required for normal polygon creation. For versioning, provide baseSitePolygonUuid."
      );
    }

    const batchRequest: CreateSitePolygonBatchRequestDto = { geometries };

    const { data: createdSitePolygons, included: validations } =
      await this.sitePolygonCreationService.createSitePolygons(batchRequest, userId, source, userFullName);

    const document = buildJsonApi(SitePolygonLightDto);
    const associations = await this.sitePolygonService.loadAssociationDtos(createdSitePolygons, true);

    for (const sitePolygon of createdSitePolygons) {
      document.addData(
        sitePolygon.uuid,
        await this.sitePolygonService.buildLightDto(sitePolygon, associations[sitePolygon.id] ?? {})
      );
    }

    if (validations.length > 0) {
      for (const validation of validations) {
        const validationDto = populateDto(new ValidationDto(), {
          polygonUuid: validation.attributes.polygonUuid,
          criteriaList: validation.attributes.criteriaList
        });
        document.addData(validation.id, validationDto);
      }
    }

    return document;
  }

  @Get()
  @ApiOperation({ operationId: "sitePolygonsIndex", summary: "Get all site polygons" })
  @JsonApiResponse([
    { data: SitePolygonFullDto, pagination: "cursor" },
    { data: SitePolygonLightDto, pagination: "number" }
  ])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "One or more query param values is invalid." })
  async findMany(@Query() query: SitePolygonQueryDto) {
    await this.policyService.authorize("readAll", SitePolygon);

    const {
      siteId,
      projectId,
      projectShortNames,
      includeTestProjects,
      missingIndicator,
      presentIndicator,
      lightResource,
      projectCohort,
      landscape,
      validationStatus,
      polygonUuid
    } = query;
    let countSelectedParams = [siteId, projectId].filter(param => param != null).length;
    // these two can be used together, but not along with the other project / site filters.
    if (projectCohort != null || landscape != null) countSelectedParams++;

    if (lightResource && !isNumberPage(query.page)) {
      throw new BadRequestException("Light resources must use number pagination.");
    }

    if (countSelectedParams > 1) {
      throw new BadRequestException(
        "Only one of siteId, projectId, projectCohort, landscape, and includeTestProjects may be used in a single request."
      );
    }
    if (missingIndicator != null && presentIndicator != null) {
      throw new BadRequestException(
        "Only one of missingIndicator[] or presentIndicator[] may be used in a single request."
      );
    }

    const page = query.page ?? {};
    page.size ??= MAX_PAGE_SIZE;
    if (page.size > MAX_PAGE_SIZE || page.size < 1) {
      throw new BadRequestException("Page size is invalid");
    }

    if (isNumberPage(page) && page.number < 1) {
      throw new BadRequestException("Page number is invalid");
    }

    const queryBuilder = (await this.sitePolygonService.buildQuery(page))
      .hasStatuses(query.polygonStatus)
      .modifiedSince(query.lastModifiedDate);

    if (missingIndicator != null && missingIndicator.length > 0) {
      queryBuilder.isMissingIndicators(missingIndicator);
    } else if (presentIndicator != null && presentIndicator.length > 0) {
      queryBuilder.hasPresentIndicators(presentIndicator);
    }

    if (siteId != null) {
      await queryBuilder.filterSiteUuids(siteId);
    }

    if (projectId != null) {
      await queryBuilder.filterProjectUuids(projectId);
    }

    if (projectShortNames != null) {
      await queryBuilder.filterProjectShortNames(projectShortNames);
    }

    if (validationStatus != null) {
      await queryBuilder.filterValidationStatus(validationStatus);
    }

    if (projectCohort != null || landscape != null) {
      await queryBuilder.filterProjectAttributes(projectCohort, landscape);
    }

    if (polygonUuid != null) {
      await queryBuilder.filterPolygonUuids(polygonUuid);
    }

    // Ensure test projects are excluded only if not included explicitly
    if (!includeTestProjects && siteId == null && projectId == null) {
      await queryBuilder.excludeTestProjects();
    }
    if (query.search != null) {
      await queryBuilder.addSearch(query.search);
    }

    if (query.sort != null && query.sort.field != null) {
      if (!isNumberPage(page)) {
        throw new BadRequestException("Sorting is only supported with number pagination.");
      }
      const direction = query.sort.direction ?? "ASC";
      const field = query.sort.field;
      if (["name", "status", "createdAt"].includes(field)) {
        if (field === "name") {
          queryBuilder.order(["polyName", direction]);
        } else if (field === "status") {
          queryBuilder.order(["status", direction]);
        } else {
          queryBuilder.order(["createdAt", direction]);
        }
      } else {
        throw new BadRequestException(`Invalid sort field: ${field}`);
      }
    }

    const dtoType = lightResource ? SitePolygonLightDto : SitePolygonFullDto;

    const document = buildJsonApi(dtoType, { pagination: isNumberPage(query.page) ? "number" : "cursor" });
    const sitePolygons = await queryBuilder.execute();
    const associations = await this.sitePolygonService.loadAssociationDtos(sitePolygons, lightResource ?? false);
    let cursor: string | undefined = undefined;
    for (const sitePolygon of sitePolygons) {
      if (cursor == null) cursor = sitePolygon.uuid;
      if (lightResource) {
        document.addData(
          sitePolygon.uuid,
          await this.sitePolygonService.buildLightDto(sitePolygon, associations[sitePolygon.id] ?? {})
        );
      } else {
        document.addData(
          sitePolygon.uuid,
          await this.sitePolygonService.buildFullDto(sitePolygon, associations[sitePolygon.id] ?? {})
        );
      }
    }

    const indexData: Partial<IndexData> & { requestPath: string } = {
      requestPath: `/research/v3/sitePolygons${getStableRequestQuery(query)}`,
      total: await queryBuilder.paginationTotal()
    };
    if (isNumberPage(query.page)) indexData.pageNumber = query.page.number;
    else indexData.cursor = cursor;
    return document.addIndex(indexData);
  }

  @Patch()
  @ApiOperation({
    operationId: "bulkUpdateSitePolygons",
    summary: "Update indicators for site polygons",
    description: `If an indicator is provided that already exists, it will be updated with the value in the
       payload. If a new indicator is provided, it will be created in the DB. Indicators are keyed
       off of the combination of site polygon ID, indicatorSlug, and yearOfAnalysis.`
  })
  @ApiOkResponse()
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "One or more of the data payload members has a problem." })
  @ExceptionResponse(NotFoundException, { description: "A site polygon specified in the data was not found." })
  async bulkUpdate(@Body() updatePayload: SitePolygonBulkUpdateBodyDto): Promise<void> {
    await this.policyService.authorize("updateAll", SitePolygon);

    await this.sitePolygonService.transaction(async transaction => {
      const updates: Promise<void>[] = [];
      for (const update of updatePayload.data) {
        for (const indicator of update.attributes.indicators) {
          updates.push(this.sitePolygonService.updateIndicator(update.id, indicator, transaction));
        }
      }

      await Promise.all(updates);
    });
  }

  @Get(":uuid/versions")
  @ApiOperation({
    operationId: "listSitePolygonVersions",
    summary: "Get all versions of a site polygon",
    description: "Returns all versions sharing the same primaryUuid, ordered by creation date (newest first)"
  })
  @JsonApiResponse({ data: SitePolygonLightDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Site polygon not found." })
  async getVersions(@Param("uuid") uuid: string) {
    await this.policyService.authorize("read", SitePolygon);

    const polygon = await SitePolygon.findOne({ where: { uuid } });
    if (polygon == null) {
      throw new NotFoundException(`Site polygon not found: ${uuid}`);
    }

    const versions = await this.versioningService.getVersionHistory(polygon.primaryUuid);

    const document = buildJsonApi(SitePolygonLightDto, { forceDataArray: true });
    const associations = await this.sitePolygonService.loadAssociationDtos(versions, false);

    for (const version of versions) {
      document.addData(
        version.uuid,
        await this.sitePolygonService.buildLightDto(version, associations[version.id] ?? {})
      );
    }

    return document;
  }

  @Patch(":uuid/version")
  @ApiOperation({
    operationId: "updateSitePolygonVersion",
    summary: "Update a site polygon version (e.g., activate/deactivate)",
    description: `Update version properties. Setting isActive to true will activate this version and deactivate all others in the version group.
      Both admins and project developers can manage versions.`
  })
  @JsonApiResponse(SitePolygonLightDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Site polygon not found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  async updateVersion(@Param("uuid") uuid: string, @Body() request: VersionUpdateBody) {
    if (uuid !== request.data.id) {
      throw new BadRequestException("Entity id in path and payload do not match");
    }

    await this.policyService.authorize("update", SitePolygon);

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    if (request.data.attributes.isActive !== true) {
      throw new BadRequestException("Only isActive: true is supported. Use DELETE to remove a version.");
    }

    if (SitePolygon.sequelize == null) {
      throw new BadRequestException("Database connection not available");
    }

    const activatedVersion = await SitePolygon.sequelize.transaction(async transaction => {
      const version = await this.versioningService.activateVersion(uuid, userId, transaction);

      if (request.data.attributes.comment != null && request.data.attributes.comment.length > 0) {
        await this.versioningService.trackChange(
          version.primaryUuid,
          version.versionName ?? "Unknown",
          `Comment: ${request.data.attributes.comment}`,
          userId,
          "update",
          undefined,
          undefined,
          transaction
        );
      }

      return version;
    });

    const document = buildJsonApi(SitePolygonLightDto);
    const associations = await this.sitePolygonService.loadAssociationDtos([activatedVersion], false);

    document.addData(
      activatedVersion.uuid,
      await this.sitePolygonService.buildLightDto(activatedVersion, associations[activatedVersion.id] ?? {})
    );

    this.logger.log(`Activated version ${activatedVersion.uuid} by user ${userId}`);

    return document;
  }

  @Delete(":uuid/version")
  @ApiOperation({
    operationId: "deleteSitePolygonVersion",
    summary: "Delete a single site polygon version",
    description: `Deletes a specific version of a site polygon. Restrictions:
       - Cannot delete the last version (use DELETE /:uuid to delete all versions)
       - Cannot delete the active version (activate another version first)
       - Only deletes polygon_geometry if not used by other versions
       - Deletes all associations (indicators, criteria_site, audit_status) for this version`
  })
  @JsonApiDeletedResponse([getDtoType(SitePolygonFullDto), getDtoType(SitePolygonLightDto)], {
    description: "Site polygon version and its associations were deleted"
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Site polygon not found." })
  @ExceptionResponse(BadRequestException, { description: "Cannot delete last version or active version." })
  async deleteVersion(@Param("uuid") uuid: string) {
    const sitePolygon = await SitePolygon.findOne({ where: { uuid } });
    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for uuid: ${uuid}`);
    }

    await this.policyService.authorize("delete", sitePolygon);

    await this.sitePolygonService.deleteSingleVersion(uuid);

    this.logger.log(`Deleted version ${uuid}`);

    return buildDeletedResponse(getDtoType(SitePolygonFullDto), uuid);
  }

  @Delete(":uuid")
  @ApiOperation({
    operationId: "deleteSitePolygon",
    summary: "Delete a site polygon and all associated records",
    description: `Deletes a site polygon and all its associated records including indicators, 
       criteria site records, audit statuses, and geometry data. This operation soft deletes 
       ALL related site polygons by primaryUuid (version management) and deletes polygon 
       geometry for all related site polygons.`
  })
  @JsonApiDeletedResponse([getDtoType(SitePolygonFullDto), getDtoType(SitePolygonLightDto)], {
    description: "Site polygon and all associated records were deleted"
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Site polygon not found." })
  async deleteOne(@Param("uuid") uuid: string) {
    const sitePolygon = await SitePolygon.findOne({ where: { uuid } });
    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for uuid: ${uuid}`);
    }

    await this.policyService.authorize("delete", sitePolygon);

    await this.sitePolygonService.deleteSitePolygon(uuid);

    return buildDeletedResponse(getDtoType(SitePolygonFullDto), uuid);
  }

  private async createVersion(
    baseSitePolygonUuid: string,
    geometries: CreateSitePolygonJsonApiRequestDto["data"]["attributes"]["geometries"],
    attributeChanges: CreateSitePolygonJsonApiRequestDto["data"]["attributes"]["attributeChanges"],
    changeReason: string,
    userId: number,
    userFullName: string | null,
    source: string
  ) {
    const hasGeometryChange = geometries != null && geometries.length > 0;
    const hasAttributeChange = attributeChanges != null && Object.keys(attributeChanges).length > 0;

    if (!hasGeometryChange && !hasAttributeChange) {
      throw new BadRequestException(
        "Version creation requires either geometry changes (geometries array) or attribute changes (attributeChanges object)"
      );
    }

    if (SitePolygon.sequelize == null) {
      throw new BadRequestException("Database connection not available");
    }

    const newVersion = await SitePolygon.sequelize.transaction(async transaction => {
      return this.sitePolygonCreationService.createSitePolygonVersion(
        baseSitePolygonUuid,
        geometries,
        attributeChanges,
        changeReason,
        userId,
        userFullName,
        source,
        transaction
      );
    });

    const document = buildJsonApi(SitePolygonLightDto);
    const associations = await this.sitePolygonService.loadAssociationDtos([newVersion], true);

    document.addData(
      newVersion.uuid,
      await this.sitePolygonService.buildLightDto(newVersion, associations[newVersion.id] ?? {})
    );

    this.logger.log(`Created version ${newVersion.uuid} from base ${baseSitePolygonUuid} by user ${userId}`);

    return document;
  }
}
