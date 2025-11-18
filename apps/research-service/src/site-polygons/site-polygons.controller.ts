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
import { SitePolygonsService } from "./site-polygons.service";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { GeometryFileProcessingService } from "./geometry-file-processing.service";
import { PolicyService } from "@terramatch-microservices/common";
import { GeometryUploadRequestDto } from "./dto/geometry-upload.dto";
import { FormDtoInterceptor } from "@terramatch-microservices/common/interceptors/form-dto.interceptor";
import "multer";
import { SitePolygon, User, DelayedJob, Site } from "@terramatch-microservices/database/entities";
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
    private readonly geometryFileProcessingService: GeometryFileProcessingService,
    private readonly policyService: PolicyService,
    @InjectQueue("geometry-upload") private readonly geometryUploadQueue: Queue
  ) {}

  private readonly logger = new Logger(SitePolygonsController.name);

  @Post()
  @ApiOperation({
    operationId: "createSitePolygons",
    summary: "Create site polygons from GeoJSON",
    description: `Create site polygons. Supports multi-site batch creation.
      Duplicate validation results are always included in the response when duplicates are found.`
  })
  @JsonApiResponse([SitePolygonLightDto])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data or site not found." })
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

    const geometries = createRequest.data.attributes.geometries;
    const batchRequest: CreateSitePolygonBatchRequestDto = { geometries };

    const { data: createdSitePolygons, included: validations } =
      await this.sitePolygonCreationService.createSitePolygons(batchRequest, userId, source, user?.fullName ?? null);

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

  @Post("geometry/upload")
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

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const user = await User.findByPk(userId, {
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
        entity_type: "App\\Models\\V2\\Sites\\Site",
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
}
