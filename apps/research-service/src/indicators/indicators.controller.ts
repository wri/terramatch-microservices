import { Body, Controller, Param, Post, Request } from "@nestjs/common";
import { ApiExtraModels, ApiOperation } from "@nestjs/swagger";
import { IndicatorTreeCoverLossDto } from "../site-polygons/dto/indicators.dto";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DelayedJob, Site, Project, SitePolygon } from "@terramatch-microservices/database/entities";
import { JsonApiResponse } from "@terramatch-microservices/common/decorators/json-api-response.decorator";
import { buildDelayedJobResponse } from "@terramatch-microservices/common/util";
import { DelayedJobDto } from "@terramatch-microservices/common/dto/delayed-job.dto";
import { IndicatorsBodyDto } from "./dto/indicators-body.dto";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { IndicatorsParamDto } from "./dto/indicators-param.dto";
import { IndicatorHectaresDto } from "../site-polygons/dto/indicators.dto";
import { SitePolygonLightDto } from "../site-polygons/dto/site-polygon.dto";
import { uniq } from "lodash";
import { isNotNull } from "@terramatch-microservices/database/types/array";
import { Op } from "sequelize";

@Controller("research/v3/indicators")
@ApiExtraModels(IndicatorTreeCoverLossDto, IndicatorHectaresDto)
export class IndicatorsController {
  private readonly logger = new TMLogger(IndicatorsController.name);

  constructor(@InjectQueue("sitePolygons") private readonly indicatorsQueue: Queue) {}

  @Post(":slug")
  @ApiOperation({
    operationId: "startIndicatorCalculation",
    summary: "Start indicator calculation"
  })
  @JsonApiResponse([DelayedJobDto, SitePolygonLightDto])
  async startIndicatorCalculation(
    @Param() { slug }: IndicatorsParamDto,
    @Body() payload: IndicatorsBodyDto,
    @Request() { authenticatedUserId }
  ) {
    this.logger.debug(`Starting indicator calculation for slug: ${slug}`);
    this.logger.debug(`payload: ${JSON.stringify(payload)}`);

    const { polygonUuids } = payload.data.attributes;

    // Determine entity information from polygons (similar to PolygonClippingController)
    let entityId: number | undefined;
    let entityType: string | undefined;
    let entityName: string;

    if (polygonUuids.length > 0) {
      const sitePolygons = await SitePolygon.findAll({
        where: {
          polygonUuid: {
            [Op.in]: polygonUuids
          }
        },
        attributes: ["siteUuid"],
        include: [
          {
            association: "site",
            attributes: ["id", "uuid", "name", "projectId"],
            include: [
              {
                association: "project",
                attributes: ["id", "uuid", "name"]
              }
            ]
          }
        ]
      });

      if (sitePolygons.length > 0) {
        const uniqueSiteUuids = uniq(sitePolygons.map(({ siteUuid }) => siteUuid).filter(isNotNull));

        if (uniqueSiteUuids.length > 0) {
          // Extract sites from sitePolygons (they're already loaded with includes)
          const sites = sitePolygons
            .map(sp => sp.site)
            .filter(isNotNull)
            .filter((site, index, self) => index === self.findIndex(s => s.uuid === site.uuid));

          if (sites.length > 0) {
            const uniqueProjectIds = new Set(sites.map(s => s.projectId).filter(id => id != null));

            if (uniqueSiteUuids.length === 1) {
              // All polygons belong to a single site
              const site = sites[0];
              entityId = site.id;
              entityType = Site.LARAVEL_TYPE;
              entityName = site.name;
            } else if (uniqueProjectIds.size === 1) {
              // All polygons belong to different sites but same project
              const project = sites[0]?.project;
              if (project != null) {
                entityId = project.id;
                entityType = Project.LARAVEL_TYPE;
                entityName = project.name ?? "Unknown Project";
              } else {
                entityName = `${polygonUuids.length} polygons`;
              }
            } else {
              // Polygons belong to multiple sites/projects
              entityName = `${polygonUuids.length} polygons`;
            }
          } else {
            entityName = `${polygonUuids.length} polygons`;
          }
        } else {
          entityName = `${polygonUuids.length} polygons`;
        }
      } else {
        entityName = `${polygonUuids.length} polygons`;
      }
    } else {
      entityName = "0 polygons";
    }

    const delayedJob = await DelayedJob.create({
      isAcknowledged: false,
      name: "Indicator Calculation",
      processedContent: 0,
      progressMessage: "Starting indicator calculation...",
      createdBy: authenticatedUserId,
      metadata: {
        ...(entityId != null && { entity_id: entityId }),
        ...(entityType != null && { entity_type: entityType }),
        entity_name: entityName
      }
    } as DelayedJob);

    await this.indicatorsQueue.add("indicatorCalculation", {
      slug,
      ...payload.data.attributes,
      delayedJobId: delayedJob.id
    });

    return buildDelayedJobResponse(delayedJob);
  }
}
