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
import { Feature, CreateSitePolygonRequestDto, AttributeChangesDto } from "./dto/create-site-polygon-request.dto";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { BadRequestException } from "@nestjs/common";
import { validateSitePolygonProperties } from "./utils/site-polygon-property-validator";
import { CriteriaId, ValidationType } from "@terramatch-microservices/database/constants";

export interface GeometryUploadJobData {
  delayedJobId: number;
  siteId: string;
  geojson: FeatureCollection;
  userId: number;
  source: string;
  userFullName: string | null;
  enableVersioning: boolean;
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
    const { geojson, siteId, userId, source, userFullName, enableVersioning } = job.data;

    if (enableVersioning) {
      return await this.processWithVersioning(job, geojson, siteId, userId, source, userFullName);
    }

    return await this.processWithoutVersioning(job, geojson, siteId, userId, source, userFullName);
  }

  private async processWithoutVersioning(
    job: Job<GeometryUploadJobData>,
    geojson: FeatureCollection,
    siteId: string,
    userId: number,
    source: string,
    userFullName: string | null
  ): Promise<DelayedJobResult> {
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

  private async processWithVersioning(
    job: Job<GeometryUploadJobData>,
    geojson: FeatureCollection,
    siteId: string,
    userId: number,
    source: string,
    userFullName: string | null
  ): Promise<DelayedJobResult> {
    const totalFeatures = geojson.features.length;

    await this.updateJobProgress(job, {
      totalContent: totalFeatures,
      processedContent: 0,
      progressMessage: `Starting to process ${totalFeatures} features with versioning...`
    });

    // Extract UUIDs from uploaded features
    const uploadedUuids: string[] = [];
    const featureUuidMap = new Map<number, string>(); // feature index -> uuid

    geojson.features.forEach((feature, index) => {
      const uuid = (feature.properties?.uuid as string) ?? null;
      if (uuid != null && uuid.length > 0) {
        uploadedUuids.push(uuid);
        featureUuidMap.set(index, uuid);
      }
    });

    // Query existing active SitePolygons for this site
    const existingPolygons =
      uploadedUuids.length > 0
        ? await SitePolygon.findAll({
            where: {
              uuid: { [Op.in]: uploadedUuids },
              siteUuid: siteId,
              isActive: true
            }
          })
        : [];

    const existingUuidSet = new Set(existingPolygons.map(p => p.uuid));
    const existingUuidToPolygon = new Map(existingPolygons.map(p => [p.uuid, p]));

    // Split features into versioning vs creation groups
    const featuresForVersioning: Array<{ feature: Feature; baseUuid: string }> = [];
    const featuresForCreation: Feature[] = [];

    geojson.features.forEach((feature, index) => {
      const uuid = featureUuidMap.get(index);
      if (uuid != null && existingUuidSet.has(uuid)) {
        featuresForVersioning.push({
          feature: {
            ...feature,
            properties: {
              ...(feature.properties ?? {}),
              site_id: siteId
            }
          } as Feature,
          baseUuid: uuid
        });
      } else {
        featuresForCreation.push({
          ...feature,
          properties: {
            ...(feature.properties ?? {}),
            site_id: siteId
          }
        } as Feature);
      }
    });

    const createdPolygons: SitePolygon[] = [];
    const createdVersions: SitePolygon[] = [];
    const allValidations: Array<{
      type: "validation";
      id: string;
      attributes: {
        polygonUuid: string;
        criteriaList: Array<{
          criteriaId: CriteriaId;
          validationType: ValidationType;
          valid: boolean;
          createdAt: Date;
          extraInfo: {
            polygonUuid: string;
            message: string;
            sitePolygonUuid?: string;
            sitePolygonName?: string;
          };
        }>;
      };
    }> = [];

    // Process new polygon creation
    if (featuresForCreation.length > 0) {
      await this.updateJobProgress(job, {
        processedContent: 0,
        progressMessage: `Creating ${featuresForCreation.length} new polygons...`
      });

      const geometries: CreateSitePolygonRequestDto[] = [
        {
          type: "FeatureCollection" as const,
          features: featuresForCreation
        }
      ];

      const { data: newPolygons, included: validations } = await this.sitePolygonCreationService.createSitePolygons(
        { geometries },
        userId,
        source,
        userFullName
      );

      createdPolygons.push(...newPolygons);
      allValidations.push(...validations);
    }

    // Process version creation
    if (featuresForVersioning.length > 0) {
      await this.updateJobProgress(job, {
        processedContent: featuresForCreation.length,
        progressMessage: `Creating ${featuresForVersioning.length} new versions...`
      });

      if (SitePolygon.sequelize == null) {
        throw new BadRequestException("Database connection not available");
      }

      await SitePolygon.sequelize.transaction(async transaction => {
        for (const { feature, baseUuid } of featuresForVersioning) {
          const basePolygon = existingUuidToPolygon.get(baseUuid);
          if (basePolygon == null) {
            this.logger.warn(`Base polygon not found for UUID: ${baseUuid}`);
            continue;
          }

          // Extract attributes from GeoJSON properties
          const properties = feature.properties ?? {};
          const allProperties = { ...properties };
          if (siteId != null) {
            allProperties.siteId = siteId;
            allProperties.site_id = siteId;
          }

          const validatedProperties = validateSitePolygonProperties(allProperties);
          const attributeChanges = this.convertPropertiesToAttributeChanges(validatedProperties);

          // Create version with geometry and attributes
          const versionGeometries: CreateSitePolygonRequestDto[] = [
            {
              type: "FeatureCollection" as const,
              features: [
                {
                  ...feature,
                  properties: {
                    ...feature.properties,
                    site_id: siteId
                  }
                } as Feature
              ]
            }
          ];

          const newVersion = await this.sitePolygonCreationService.createSitePolygonVersion(
            baseUuid,
            versionGeometries,
            attributeChanges,
            "Version created from geometry file upload",
            userId,
            userFullName,
            source,
            transaction
          );

          createdVersions.push(newVersion);
        }
      });
    }

    // Build response
    const document = buildJsonApi(SitePolygonLightDto);
    const allSitePolygons = [...createdPolygons, ...createdVersions];
    const associations = await this.sitePolygonsService.loadAssociationDtos(allSitePolygons, true);

    for (const sitePolygon of allSitePolygons) {
      document.addData(
        sitePolygon.uuid,
        await this.sitePolygonsService.buildLightDto(sitePolygon, associations[sitePolygon.id] ?? {})
      );
    }

    if (allValidations.length > 0) {
      for (const validation of allValidations) {
        const validationDto = populateDto(new ValidationDto(), {
          polygonUuid: validation.attributes.polygonUuid,
          criteriaList: validation.attributes.criteriaList
        });
        document.addData(validation.id, validationDto);
      }
    }

    return {
      processedContent: totalFeatures,
      progressMessage: `Created ${createdPolygons.length} new polygons and ${createdVersions.length} new versions`,
      payload: document
    };
  }

  /**
   * Converts validated SitePolygon properties to AttributeChangesDto format for version creation.
   * Handles date conversion and array formatting.
   */
  private convertPropertiesToAttributeChanges(properties: Partial<SitePolygon>): AttributeChangesDto {
    const attributeChanges: AttributeChangesDto = {};

    if (properties.polyName != null) {
      attributeChanges.polyName = properties.polyName;
      attributeChanges.poly_name = properties.polyName; // Backward compatibility
    }

    if (properties.plantStart != null) {
      const plantStartString =
        properties.plantStart instanceof Date ? properties.plantStart.toISOString() : String(properties.plantStart);
      attributeChanges.plantStart = plantStartString;
      attributeChanges.plantstart = plantStartString; // Backward compatibility
    }

    if (properties.practice != null && properties.practice.length > 0) {
      attributeChanges.practice = properties.practice;
    }

    if (properties.targetSys != null) {
      attributeChanges.targetSys = properties.targetSys;
      attributeChanges.target_sys = properties.targetSys; // Backward compatibility
    }

    if (properties.distr != null && properties.distr.length > 0) {
      attributeChanges.distr = properties.distr;
    }

    if (properties.numTrees != null) {
      attributeChanges.numTrees = properties.numTrees;
      attributeChanges.num_trees = properties.numTrees; // Backward compatibility
    }

    return attributeChanges;
  }
}
