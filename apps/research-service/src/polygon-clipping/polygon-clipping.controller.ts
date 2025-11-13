import {
  Body,
  Controller,
  NotFoundException,
  Post,
  UnauthorizedException,
  BadRequestException,
  Param,
  Request
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { ExceptionResponse, JsonApiResponse } from "@terramatch-microservices/common/decorators";
import { PolygonClippingService } from "./polygon-clipping.service";
import { PolygonListClippingRequestBody } from "./dto/clip-polygon-request.dto";
import { PolicyService } from "@terramatch-microservices/common";
import { DelayedJob, Site, SitePolygon, User } from "@terramatch-microservices/database/entities";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { ClippedVersionDto } from "./dto/clipped-version.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";

@ApiTags("Polygon Clipping")
@Controller("polygonClipping/v3")
export class PolygonClippingController {
  constructor(
    private readonly clippingService: PolygonClippingService,
    private readonly policyService: PolicyService,
    @InjectQueue("clipping") private readonly clippingQueue: Queue
  ) {}

  @Post("sites/:siteUuid/clippedVersions")
  @ApiOperation({
    operationId: "createSiteClippedVersions",
    summary: "Create new polygon versions with clipped geometries for a site",
    description: `Finds and clips all fixable overlapping polygons in a site (overlap ≤3.5% AND ≤0.118 hectares).
      Creates new versions asynchronously with clipped geometries. Returns a delayed job to track progress.`
  })
  @JsonApiResponse(DelayedJobDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Site not found or no fixable overlapping polygons." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  async createSiteClippedVersions(@Param("siteUuid") siteUuid: string, @Request() { authenticatedUserId }) {
    await this.policyService.authorize("update", SitePolygon);

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const user = await User.findByPk(userId, {
      include: [{ association: "roles", attributes: ["name"] }]
    });
    const source = user?.getSourceFromRoles() ?? "terramatch";
    const userFullName = user?.fullName ?? null;

    const fixablePolygons = await this.clippingService.getFixablePolygonsForSite(siteUuid);

    if (fixablePolygons.length === 0) {
      throw new NotFoundException(`No fixable overlapping polygons found for site ${siteUuid}`);
    }

    const site = await Site.findOne({
      where: { uuid: siteUuid },
      attributes: ["id", "name"]
    });

    if (site == null) {
      throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
    }

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Polygon Clipping",
      totalContent: fixablePolygons.length,
      processedContent: 0,
      progressMessage: "Starting clipping...",
      createdBy: authenticatedUserId,
      metadata: {
        entity_id: site.id,
        entity_type: "App\\Models\\V2\\Sites\\Site",
        entity_name: site.name
      }
    } as DelayedJob);

    await this.clippingQueue.add("clipAndVersion", {
      polygonUuids: fixablePolygons,
      userId,
      userFullName,
      source,
      delayedJobId: delayedJob.id
    });

    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
  }

  @Post("projects/:siteUuid/clippedVersions")
  @ApiOperation({
    operationId: "createProjectClippedVersions",
    summary: "Create new polygon versions with clipped geometries for a project",
    description: `Finds all polygons in a project (via site UUID) and clips fixable overlaps (≤3.5% AND ≤0.118 hectares).
      Creates new versions asynchronously with clipped geometries. Returns a delayed job to track progress.`
  })
  @JsonApiResponse(DelayedJobDto)
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "Project not found or no fixable overlapping polygons." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  async createProjectClippedVersions(@Param("siteUuid") siteUuid: string, @Request() { authenticatedUserId }) {
    await this.policyService.authorize("update", SitePolygon);

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const user = await User.findByPk(userId, {
      include: [{ association: "roles", attributes: ["name"] }]
    });
    const source = user?.getSourceFromRoles() ?? "terramatch";
    const userFullName = user?.fullName ?? null;

    const fixablePolygons = await this.clippingService.getFixablePolygonsForProjectBySite(siteUuid);

    if (fixablePolygons.length === 0) {
      throw new NotFoundException(`No fixable overlapping polygons found for project via site ${siteUuid}`);
    }

    const site = await Site.findOne({
      where: { uuid: siteUuid },
      attributes: ["id", "name", "projectId"]
    });

    if (site == null) {
      throw new NotFoundException(`Site with UUID ${siteUuid} not found`);
    }

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Polygon Clipping",
      totalContent: fixablePolygons.length,
      processedContent: 0,
      progressMessage: "Starting clipping...",
      createdBy: authenticatedUserId,
      metadata: {
        entity_id: site.projectId,
        entity_type: "App\\Models\\V2\\Projects\\Project",
        entity_name: site.name
      }
    } as DelayedJob);

    await this.clippingQueue.add("clipAndVersion", {
      polygonUuids: fixablePolygons,
      userId,
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
  @JsonApiResponse([ClippedVersionDto, DelayedJobDto])
  @ExceptionResponse(UnauthorizedException, { description: "Authentication failed." })
  @ExceptionResponse(NotFoundException, { description: "No fixable overlapping polygons found." })
  @ExceptionResponse(BadRequestException, { description: "Invalid request data." })
  async createPolygonListClippedVersions(
    @Body() payload: PolygonListClippingRequestBody,
    @Request() { authenticatedUserId }
  ) {
    await this.policyService.authorize("update", SitePolygon);

    const userId = this.policyService.userId;
    if (userId == null) {
      throw new UnauthorizedException("User must be authenticated");
    }

    const user = await User.findByPk(userId, {
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
        userId,
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

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Polygon Clipping",
      totalContent: fixablePolygons.length,
      processedContent: 0,
      progressMessage: "Starting clipping...",
      createdBy: authenticatedUserId,
      metadata: {
        entity_type: "Polygons",
        entity_name: `${fixablePolygons.length} polygons`
      }
    } as DelayedJob);

    await this.clippingQueue.add("clipAndVersion", {
      polygonUuids: fixablePolygons,
      userId,
      userFullName,
      source,
      delayedJobId: delayedJob.id
    });

    return buildJsonApi(DelayedJobDto).addData(delayedJob.uuid, new DelayedJobDto(delayedJob));
  }
}
