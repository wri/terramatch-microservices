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
  UnauthorizedException,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
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
import { SitePolygonBulkDeleteBodyDto } from "./dto/site-polygon-bulk-delete.dto";
import { SitePolygonsService } from "./site-polygons.service";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { GeometryFileProcessingService } from "./geometry-file-processing.service";
import { PolicyService } from "@terramatch-microservices/common";
import { GeometryUploadRequestDto } from "./dto/geometry-upload.dto";
import { FormDtoInterceptor } from "@terramatch-microservices/common/interceptors/form-dto.interceptor";
import "multer";
import { SitePolygon, User, DelayedJob, Site } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { GeometryUploadJobData } from "./geometry-upload.processor";
import { isNumberPage } from "@terramatch-microservices/common/dto/page.dto";
import {
  CreateSitePolygonBatchRequestDto,
  CreateSitePolygonJsonApiRequestDto
} from "./dto/create-site-polygon-request.dto";
import { ValidationDto } from "../validations/dto/validation.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { VersionUpdateBody } from "./dto/version-update.dto";
import { SitePolygonVersioningService } from "./site-polygon-versioning.service";
import { GeoJsonExportService } from "../geojson-export/geojson-export.service";
import { GeoJsonQueryDto } from "../geojson-export/dto/geojson-query.dto";
import { GeoJsonExportDto } from "../geojson-export/dto/geojson-export.dto";
import { GeometryUploadComparisonSummaryDto } from "./dto/geometry-upload-comparison-summary.dto";
import { GeometryUploadComparisonService } from "./geometry-upload-comparison.service";
import { PolygonStatus } from "@terramatch-microservices/database/constants";

const MAX_PAGE_SIZE = 100 as const;

@Controller("research/v3/sitePolygons")
@ApiExtraModels(
  IndicatorTreeCoverLossDto,
  IndicatorHectaresDto,
  IndicatorTreeCountDto,
  IndicatorTreeCoverDto,
  IndicatorFieldMonitoringDto,
  IndicatorMsuCarbonDto,
  ValidationDto,
  GeoJsonExportDto,
  GeometryUploadComparisonSummaryDto
)
export class SitePolygonsController {
  constructor(
    private readonly sitePolygonService: SitePolygonsService,
    private readonly sitePolygonCreationService: SitePolygonCreationService,
    private readonly geometryFileProcessingService: GeometryFileProcessingService,
    private readonly policyService: PolicyService,
    private readonly versioningService: SitePolygonVersioningService,
    private readonly geoJsonExportService: GeoJsonExportService,
    private readonly geometryUploadComparisonService: GeometryUploadComparisonService,
    @InjectQueue("geometry-upload") private readonly geometryUploadQueue: Queue
  ) {}

  private readonly logger = new Logger(SitePolygonsController.name);

  @Post()
  @ApiOperation({
    operationId: "createSitePolygons",
    summary: "Create site polygons from GeoJSON or create version from existing",
    description: `Create site polygons OR create a new version of an existing polygon.

    Normal Creation (new polygons):
    - Provide \`geometries\` array with \`siteId\`in feature properties (required)
    - Attributes (polyName, plantstart, practice, etc.) come from feature \`properties\`
    - Properties support both camelCase and snake_case
    - Do NOT provide \`baseSitePolygonUuid\` or \`attributeChanges\`
    
    Version Creation (new version of existing polygon):
    - Provide \`baseSitePolygonUuid\` (required) + \`changeReason\` (optional, defaults to "Version created via API")
    - Then provide ONE of the following:
      - Geometry only: Provide \`geometries\` array (geometry properties are ignored)
      - Attributes only: Provide \`attributeChanges\` object
      - Both: Provide both \`geometries\` and \`attributeChanges\`
    - At least one of \`geometries\` or \`attributeChanges\` must be provided
    
    Important: When creating versions, \`attributeChanges\` is the ONLY way to update attributes. 
    Geometry properties are ignored during version creation - use \`attributeChanges\` instead.
    
    Duplicate validation results are included in the \`included\` section of the JSON:API response when duplicates are found.
    Property naming: GeoJSON properties support both camelCase and snake_case.`
  })
  @JsonApiResponse({ data: SitePolygonLightDto, included: [ValidationDto] })
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
      attributes: ["firstName", "lastName"],
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

  @Get("geojson")
  @ApiOperation({
    operationId: "getSitePolygonsGeoJson",
    summary: "Export site polygons as GeoJSON",
    description: `Export site polygons as GeoJSON FeatureCollection. 
    Provide exactly one of: uuid (single polygon), siteUuid (all active polygons in a site), or projectUuid (all active polygons across all sites in a project).
    Use includeExtendedData to include additional data from site_polygon_data table.
    Use geometryOnly to return only geometry without properties (only applicable when using uuid).`
  })
  @JsonApiResponse(GeoJsonExportDto)
  @ExceptionResponse(BadRequestException, {
    description: "Invalid query parameters (must provide exactly one of uuid, siteUuid, or projectUuid)"
  })
  @ExceptionResponse(NotFoundException, {
    description: "Polygon, site polygon, or site not found"
  })
  @ExceptionResponse(UnauthorizedException, {
    description: "Authentication failed"
  })
  async getGeoJson(@Query() query: GeoJsonQueryDto) {
    await this.policyService.authorize("read", SitePolygon);

    const featureCollection = await this.geoJsonExportService.getGeoJson(query);

    const document = buildJsonApi(GeoJsonExportDto);

    const resourceId = (query.uuid ?? query.siteUuid ?? query.projectUuid) as string;

    return document.addData(resourceId, new GeoJsonExportDto(featureCollection));
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
    await this.policyService.authorize("read", SitePolygon);

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

  @Patch("/status/:status")
  @ApiOperation({
    operationId: "updateSitePolygonStatus",
    summary: "Update the status of a site polygon",
    description: "Update the status of a site polygon"
  })
  @JsonApiResponse({ data: SitePolygonLightDto })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  @ExceptionResponse(NotFoundException, { description: "Site polygon not found." })
  async updateStatus(@Param("status") status: PolygonStatus, @Body() request: SitePolygonBulkUpdateBodyDto) {
    console.log("request", request);
    await this.policyService.authorize("update", SitePolygon);
    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }
    const user = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName", "emailAddress"]
    });
    const { data, comment } = request;
    const updatedUuids = await this.sitePolygonService.updateStatus(status, data, comment, user);
    const document = buildJsonApi(SitePolygonLightDto);
    for (const sitePolygon of updatedUuids) {
      document.addData(sitePolygon.uuid, await this.sitePolygonService.buildLightDto(sitePolygon, {}));
    }
    return document;
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

  @Delete()
  @ApiOperation({
    operationId: "bulkDeleteSitePolygons",
    summary: "Bulk delete site polygons and all associated records",
    description: `Deletes multiple site polygons and all their associated records including indicators, 
       criteria site records, audit statuses, and geometry data. This operation soft deletes 
       ALL related site polygons by primaryUuid (version management) and deletes polygon 
       geometry for all related site polygons. The request body follows JSON:API format with 
       an array of resource identifiers (type and id).`
  })
  @JsonApiDeletedResponse([getDtoType(SitePolygonFullDto), getDtoType(SitePolygonLightDto)], {
    description: "Site polygons and all associated records were deleted"
  })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request body or empty UUID list." })
  @ExceptionResponse(NotFoundException, { description: "One or more site polygons not found." })
  async bulkDelete(@Body() deletePayload: SitePolygonBulkDeleteBodyDto) {
    const uuids = deletePayload.data.map(item => item.id);

    const sitePolygons = await SitePolygon.findAll({
      where: { uuid: { [Op.in]: uuids } },
      attributes: ["id", "uuid", "primaryUuid", "siteUuid", "createdBy"]
    });

    if (sitePolygons.length === 0) {
      throw new NotFoundException(`No site polygons found for the provided UUIDs`);
    }

    const foundUuids = new Set(sitePolygons.map(sp => sp.uuid));
    const missingUuids = uuids.filter(uuid => !foundUuids.has(uuid));
    if (missingUuids.length > 0) {
      throw new NotFoundException(`Site polygons not found for UUIDs: ${missingUuids.join(", ")}`);
    }

    for (const sitePolygon of sitePolygons) {
      await this.policyService.authorize("delete", sitePolygon);
    }

    const deletedUuids = await this.sitePolygonService.bulkDeleteSitePolygons(sitePolygons);

    return buildDeletedResponse(getDtoType(SitePolygonFullDto), deletedUuids);
  }

  @Get(":primaryUuid/versions")
  @ApiOperation({
    operationId: "listSitePolygonVersions",
    summary: "Get all versions of a site polygon",
    description: "Returns all versions sharing the same primaryUuid, ordered by creation date (newest first)"
  })
  @JsonApiResponse({ data: SitePolygonLightDto, hasMany: true })
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Site polygon not found." })
  async getVersions(@Param("primaryUuid") primaryUuid: string) {
    await this.policyService.authorize("read", SitePolygon);

    const versions = await this.versioningService.getVersionHistory(primaryUuid);
    if (versions.length === 0) {
      throw new NotFoundException(`Site polygon not found: ${primaryUuid}`);
    }

    const document = buildJsonApi(SitePolygonLightDto, { forceDataArray: true });
    const associations = await this.sitePolygonService.loadAssociationDtos(versions, false);

    const versionIds: string[] = [];
    for (const version of versions) {
      versionIds.push(version.uuid);
      document.addData(
        version.uuid,
        await this.sitePolygonService.buildLightDto(version, associations[version.id] ?? {})
      );
    }

    document.addIndex({
      requestPath: `/research/v3/sitePolygons/${primaryUuid}/versions`,
      total: versions.length
    });

    if (document.indexData.length > 0) {
      document.indexData[document.indexData.length - 1].ids = versionIds;
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

  @Post("upload/comparison")
  @ApiOperation({
    operationId: "compareGeometryFile",
    summary: "Compare uploaded geometry file with existing polygons",
    description: `Parses a geometry file and returns UUIDs of existing SitePolygons found in the database.`
  })
  @UseInterceptors(FileInterceptor("file"), FormDtoInterceptor)
  @JsonApiResponse(GeometryUploadComparisonSummaryDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid file format, file parsing failed, or no features found in file."
  })
  @ExceptionResponse(NotFoundException, { description: "Site not found." })
  async compareGeometryFile(@UploadedFile() file: Express.Multer.File, @Body() payload: GeometryUploadRequestDto) {
    await this.policyService.authorize("read", SitePolygon);

    const siteId = payload.data.attributes.siteId;

    const site = await Site.findOne({
      where: { uuid: siteId },
      attributes: ["id", "name"]
    });

    if (site == null) {
      throw new NotFoundException(`Site with UUID ${siteId} not found`);
    }

    const geojson = await this.geometryFileProcessingService.parseGeometryFile(file);

    const comparisonResult = await this.geometryUploadComparisonService.compareUploadedFeaturesWithExisting(
      geojson,
      siteId
    );

    const document = buildJsonApi(GeometryUploadComparisonSummaryDto);

    document.addData(
      "summary",
      new GeometryUploadComparisonSummaryDto({
        existingUuids: comparisonResult.existingUuids,
        totalFeatures: comparisonResult.totalFeatures,
        featuresForVersioning: comparisonResult.featuresForVersioning,
        featuresForCreation: comparisonResult.featuresForCreation
      })
    );

    return document;
  }

  @Post("upload")
  @ApiOperation({
    operationId: "uploadGeometryFile",
    summary: "Upload and parse geometry file (KML, Shapefile, GeoJSON)",
    description: `Parses a geometry file (KML, Shapefile, or GeoJSON) and creates site polygons asynchronously.
      Supported formats: KML (.kml), Shapefile (.zip with .shp/.shx/.dbf), GeoJSON (.geojson)`
  })
  @UseInterceptors(FileInterceptor("file"), FormDtoInterceptor)
  @JsonApiResponse([SitePolygonLightDto, DelayedJobDto])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid file format, file parsing failed, or no features found in file."
  })
  @ExceptionResponse(NotFoundException, { description: "Site not found." })
  async uploadGeometryFile(@UploadedFile() file: Express.Multer.File, @Body() payload: GeometryUploadRequestDto) {
    await this.policyService.authorize("create", SitePolygon);

    const userId = this.policyService.userId as number;

    const user = await User.findByPk(userId, {
      attributes: ["firstName", "lastName"],
      include: [{ association: "roles", attributes: ["name"] }]
    });
    const source = user?.getSourceFromRoles() ?? "terramatch";

    const siteId = payload.data.attributes.siteId;

    const site = await Site.findOne({
      where: { uuid: siteId },
      attributes: ["id", "name"]
    });

    if (site == null) {
      throw new NotFoundException(`Site with UUID ${siteId} not found`);
    }

    const geojson = await this.geometryFileProcessingService.parseGeometryFile(file);

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Geometry Upload",
      totalContent: geojson.features.length,
      processedContent: 0,
      progressMessage: "Parsing geometry file...",
      createdBy: userId,
      metadata: {
        entity_id: site.id,
        entity_type: Site.LARAVEL_TYPE,
        entity_name: site.name
      }
    } as DelayedJob);

    const jobData: GeometryUploadJobData = {
      delayedJobId: delayedJob.id,
      siteId,
      geojson,
      userId,
      source,
      userFullName: user?.fullName ?? null
    };

    await this.geometryUploadQueue.add("geometryUpload", jobData);

    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
  }

  @Post("upload/versions")
  @ApiOperation({
    operationId: "uploadGeometryFileWithVersions",
    summary: "Upload geometry file and create versions for existing polygons",
    description: `Parses a geometry file and processes it with versioning enabled. 
      Features with UUIDs in properties.uuid that match existing active SitePolygons will create new versions.
      Features without matching UUIDs (or without UUIDs) will create new polygons.
      Attributes are extracted from GeoJSON feature properties for both versions and new polygons.
      Supported formats: KML (.kml), Shapefile (.zip with .shp/.shx/.dbf), GeoJSON (.geojson)`
  })
  @UseInterceptors(FileInterceptor("file"), FormDtoInterceptor)
  @JsonApiResponse([SitePolygonLightDto, DelayedJobDto])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid file format, file parsing failed, or no features found in file."
  })
  @ExceptionResponse(NotFoundException, { description: "Site not found." })
  async uploadGeometryFileWithVersions(
    @UploadedFile() file: Express.Multer.File,
    @Body() payload: GeometryUploadRequestDto
  ) {
    await this.policyService.authorize("create", SitePolygon);

    const userId = this.policyService.userId as number;

    const user = await User.findByPk(userId, {
      attributes: ["firstName", "lastName"],
      include: [{ association: "roles", attributes: ["name"] }]
    });
    const source = user?.getSourceFromRoles() ?? "terramatch";

    const siteId = payload.data.attributes.siteId;

    const site = await Site.findOne({
      where: { uuid: siteId },
      attributes: ["id", "name"]
    });

    if (site == null) {
      throw new NotFoundException(`Site with UUID ${siteId} not found`);
    }

    const geojson = await this.geometryFileProcessingService.parseGeometryFile(file);

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Geometry Upload with Versioning",
      totalContent: geojson.features.length,
      processedContent: 0,
      progressMessage: "Parsing geometry file...",
      createdBy: userId,
      metadata: {
        entity_id: site.id,
        entity_type: Site.LARAVEL_TYPE,
        entity_name: site.name
      }
    } as DelayedJob);

    const jobData: GeometryUploadJobData = {
      delayedJobId: delayedJob.id,
      siteId,
      geojson,
      userId,
      source,
      userFullName: user?.fullName ?? null
    };

    await this.geometryUploadQueue.add("geometryUploadWithVersions", jobData);

    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
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
