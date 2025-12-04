import { Processor } from "@nestjs/bullmq";
import { Job } from "bullmq";
import {
  DelayedJobWorker,
  DelayedJobResult
} from "@terramatch-microservices/common/workers/delayed-job-worker.processor";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { SitePolygonCreationService } from "./site-polygon-creation.service";
import { SitePolygonsService } from "./site-polygons.service";
import { buildJsonApi } from "@terramatch-microservices/common/util";
import { SitePolygonLightDto } from "./dto/site-polygon.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { ValidationDto } from "../validations/dto/validation.dto";
import { FeatureCollection } from "geojson";
import { Feature, CreateSitePolygonRequestDto } from "./dto/create-site-polygon-request.dto";

export interface GeometryUploadJobData {
  delayedJobId: number;
  siteId: string;
  geojson: FeatureCollection;
  userId: number;
  source: string;
  userFullName: string | null;
}

@Processor("geometry-upload")
export class GeometryUploadProcessor extends DelayedJobWorker<GeometryUploadJobData> {
  protected readonly logger = new TMLogger(GeometryUploadProcessor.name);

  constructor(
    private readonly sitePolygonCreationService: SitePolygonCreationService,
    private readonly sitePolygonsService: SitePolygonsService
  ) {
    super();
  }

  async processDelayedJob(job: Job<GeometryUploadJobData>): Promise<DelayedJobResult> {
    const { geojson, siteId, userId, source, userFullName } = job.data;

    const totalFeatures = geojson.features.length;

    await this.updateJobProgress(job, {
      totalContent: totalFeatures,
      processedContent: 0,
      progressMessage: `Starting to process ${totalFeatures} features...`
    });

    const geometries: CreateSitePolygonRequestDto[] = [
      {
        type: "FeatureCollection" as const,
        features: geojson.features.map(f => ({
          ...f,
          properties: {
            ...f.properties,
            site_id: siteId
          }
        })) as Feature[]
      }
    ];

    const { data: createdSitePolygons, included: validations } =
      await this.sitePolygonCreationService.createSitePolygons({ geometries }, userId, source, userFullName);

    const document = buildJsonApi(SitePolygonLightDto);
    const associations = await this.sitePolygonsService.loadAssociationDtos(createdSitePolygons, true);

    for (const sitePolygon of createdSitePolygons) {
      document.addData(
        sitePolygon.uuid,
        await this.sitePolygonsService.buildLightDto(sitePolygon, associations[sitePolygon.id] ?? {})
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

    return {
      processedContent: totalFeatures,
      progressMessage: `Created ${createdSitePolygons.length} polygons`,
      payload: document
    };
  }
}
