import { Injectable } from "@nestjs/common";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { FeatureCollection } from "geojson";

export interface ComparisonResult {
  existingUuids: string[];
  totalFeatures: number;
  featuresForVersioning: number;
  featuresForCreation: number;
}

@Injectable()
export class GeometryUploadComparisonService {
  async compareUploadedFeaturesWithExisting(geojson: FeatureCollection, siteId: string): Promise<ComparisonResult> {
    const uploadedUuids: string[] = [];

    geojson.features.forEach(feature => {
      const uuid = (feature.properties?.uuid as string) ?? null;
      if (uuid != null && uuid.length > 0) {
        uploadedUuids.push(uuid);
      }
    });

    const existingPolygons =
      uploadedUuids.length > 0
        ? await SitePolygon.findAll({
            where: {
              uuid: { [Op.in]: uploadedUuids },
              siteUuid: siteId,
              isActive: true
            },
            attributes: ["uuid"]
          })
        : [];

    const existingUuids = existingPolygons.map(p => p.uuid);
    const existingUuidSet = new Set(existingUuids);

    let featuresForVersioning = 0;
    let featuresForCreation = 0;

    uploadedUuids.forEach(uuid => {
      if (existingUuidSet.has(uuid)) {
        featuresForVersioning++;
      } else {
        featuresForCreation++;
      }
    });

    const featuresWithoutUuid = geojson.features.length - uploadedUuids.length;
    featuresForCreation += featuresWithoutUuid;

    return {
      existingUuids,
      totalFeatures: geojson.features.length,
      featuresForVersioning,
      featuresForCreation
    };
  }
}
