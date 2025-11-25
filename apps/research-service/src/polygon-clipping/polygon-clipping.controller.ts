import {
  Body,
  Controller,
  NotFoundException,
  Post,
  UnauthorizedException,
  BadRequestException,
  Request,
  Query
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { PolygonClippingService } from "./polygon-clipping.service";
import { PolygonListClippingRequestBody } from "./dto/clip-polygon-request.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { DelayedJob, Project, Site, SitePolygon, User } from "@terramatch-microservices/database/entities";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ClippedVersionDto } from "./dto/clipped-version.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ClippingQueryDto } from "./dto/clipping-query.dto";
import { isEmpty, uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";

@ApiTags("Polygon Clipping")
@Controller("polygonClipping/v3")
export class PolygonClippingController {
  constructor(
    private readonly clippingService: PolygonClippingService,
    private readonly policyService: PolicyService,
    @InjectQueue("clipping") private readonly clippingQueue: Queue
  ) {}

  @Post("clippedVersions")
  @ApiOperation({
    operationId: "createClippedVersions",
    summary: "Create new polygon versions with clipped geometries for a site or project",
    description: `Finds and clips all fixable overlapping polygons (overlap ≤3.5% AND ≤0.118 hectares) for a site or project.
      Creates new versions asynchronously with clipped geometries. Returns a delayed job to track progress.
      Provide either siteUuid or projectUuid as a query parameter, but not both.`
  })
  @JsonApiResponse([DelayedJobDto, ClippedVersionDto])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Entity not found or no fixable overlapping polygons." })
  @ExceptionResponse(BadRequestException, {
    description: "Invalid request - must provide exactly one of siteUuid or projectUuid."
  })
  async createClippedVersions(@Query() query: ClippingQueryDto, @Request() { authenticatedUserId }) {
    await this.policyService.authorize("update", SitePolygon);

    if (authenticatedUserId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    // Validate that exactly one parameter is provided
    const hasSiteUuid = !isEmpty(query.siteUuid);
    const hasProjectUuid = !isEmpty(query.projectUuid);

    if (hasSiteUuid === hasProjectUuid) {
      throw new BadRequestException("Exactly one of siteUuid or projectUuid must be provided");
    }

    const user = await User.findByPk(authenticatedUserId, {
      attributes: ["firstName", "lastName"],
      include: [{ association: "roles", attributes: ["name"] }]
    });
    const source = user?.getSourceFromRoles() ?? "terramatch";
    const userFullName = user?.fullName ?? null;

    let fixablePolygons: string[];
    let entityId: number;
    let entityType: string;
    let entityName: string;

    if (hasSiteUuid) {
      if (query.siteUuid == null) {
        throw new BadRequestException("Parameter siteUuid must be a string");
      }

      const result = await this.clippingService.getFixablePolygonsForSite(query.siteUuid);
      fixablePolygons = result.polygonIds;

      if (fixablePolygons.length === 0) {
        throw new NotFoundException(`No fixable overlapping polygons found for site ${query.siteUuid}`);
      }

      entityId = result.site.id;
      entityType = Site.LARAVEL_TYPE;
      entityName = result.site.name;
    } else {
      if (query.projectUuid == null) {
        throw new BadRequestException("Parameter projectUuid must be a string");
      }

      const result = await this.clippingService.getFixablePolygonsForProject(query.projectUuid);
      fixablePolygons = result.polygonIds;

      if (fixablePolygons.length === 0) {
        throw new NotFoundException(`No fixable overlapping polygons found for project ${query.projectUuid}`);
      }

      entityId = result.project.id;
      entityType = Project.LARAVEL_TYPE;
      entityName = result.project.name ?? "Unknown Project";
    }

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Polygon Clipping",
      totalContent: fixablePolygons.length,
      processedContent: 0,
      progressMessage: "Starting clipping...",
      createdBy: authenticatedUserId,
      metadata: {
        entity_id: entityId,
        entity_type: entityType,
        entity_name: entityName
      }
    } as DelayedJob);

    await this.clippingQueue.add("clipAndVersion", {
      polygonUuids: fixablePolygons,
      userId: authenticatedUserId,
      userFullName,
      source,
      delayedJobId: delayedJob.id
    });

    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
  }

  @Post("polygons")
  @ApiOperation({
    operationId: "createPolygonListClippedVersions",
    summary: "Create new versions with clipped geometries for a list of polygons",
    description: `Clips a specific list of polygons for fixable overlaps (≤3.5% AND ≤0.118 hectares).
      Creates new versions with clipped geometries. For a single polygon, returns immediately.
      For multiple polygons, returns a delayed job to track progress.`
  })
  @JsonApiResponse([DelayedJobDto, ClippedVersionDto])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "No fixable overlapping polygons found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  async createPolygonListClippedVersions(
    @Body() payload: PolygonListClippingRequestBody,
    @Request() { authenticatedUserId }
  ) {
    await this.policyService.authorize("update", SitePolygon);

    if (authenticatedUserId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const user = await User.findByPk(authenticatedUserId, {
      attributes: ["firstName", "lastName"],
      include: [{ association: "roles", attributes: ["name"] }]
    });
    const source = user?.getSourceFromRoles() ?? "terramatch";
    const userFullName = user?.fullName ?? null;

    const polygonUuids = payload.data.attributes.polygonUuids;

    if (polygonUuids.length === 0) {
      throw new BadRequestException("No polygon UUIDs provided");
    }

    const fixablePolygons = await this.clippingService.filterFixablePolygonsFromList(polygonUuids);

    if (fixablePolygons.length === 0) {
      throw new NotFoundException("No fixable overlapping polygons found in the provided list");
    }

    if (fixablePolygons.length === 1) {
      const createdVersions = await this.clippingService.clipAndCreateVersions(
        fixablePolygons,
        authenticatedUserId,
        userFullName,
        source
      );

      if (createdVersions.length === 0) {
        throw new NotFoundException("Failed to clip polygons");
      }

      const version = createdVersions[0];
      return buildJsonApi(ClippedVersionDto).addData(
        version.uuid,
        populateDto(new ClippedVersionDto(), {
          uuid: version.uuid,
          polyName: version.polyName,
          originalArea: version.originalArea,
          newArea: version.newArea,
          areaRemoved: version.areaRemoved
        })
      );
    }

    const sitePolygons = await SitePolygon.findAll({
      where: {
        polygonUuid: fixablePolygons,
        isActive: true
      },
      attributes: ["siteUuid"]
    });

    let entityId: number | undefined;
    let entityType: string | undefined;
    let entityName: string;

    if (sitePolygons.length > 0) {
      const uniqueSiteUuids = uniq(sitePolygons.map(({ siteUuid }) => siteUuid).filter(isNotNull));

      if (uniqueSiteUuids.length > 0) {
        const sites = await Site.findAll({
          where: { uuid: uniqueSiteUuids },
          attributes: ["id", "uuid", "name", "projectId"],
          include: [
            {
              association: "project",
              attributes: ["id", "uuid", "name"]
            }
          ]
        });

        if (sites.length > 0) {
          const uniqueProjectIds = new Set(sites.map(s => s.projectId).filter(id => id != null));

          if (uniqueSiteUuids.length === 1) {
            const site = sites[0];
            entityId = site.id;
            entityType = Site.LARAVEL_TYPE;
            entityName = site.name;
          } else if (uniqueProjectIds.size === 1) {
            const project = sites[0]?.project;
            if (project != null) {
              entityId = project.id;
              entityType = Project.LARAVEL_TYPE;
              entityName = project.name ?? "Unknown Project";
            } else {
              entityName = `${fixablePolygons.length} polygons`;
            }
          } else {
            entityName = `${fixablePolygons.length} polygons`;
          }
        } else {
          entityName = `${fixablePolygons.length} polygons`;
        }
      } else {
        entityName = `${fixablePolygons.length} polygons`;
      }
    } else {
      entityName = `${fixablePolygons.length} polygons`;
    }

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Polygon Clipping",
      totalContent: fixablePolygons.length,
      processedContent: 0,
      progressMessage: "Starting clipping...",
      createdBy: authenticatedUserId,
      metadata: {
        ...(entityId != null && { entity_id: entityId }),
        ...(entityType != null && { entity_type: entityType }),
        entity_name: entityName
      }
    } as DelayedJob);

    await this.clippingQueue.add("clipAndVersion", {
      polygonUuids: fixablePolygons,
      userId: authenticatedUserId,
      userFullName,
      source,
      delayedJobId: delayedJob.id
    });

    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
  }
}
