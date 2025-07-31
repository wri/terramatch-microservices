import { Injectable, BadRequestException } from "@nestjs/common";
import { FeatureCollection, Feature } from "geojson";
import { GeometryResponseDto } from "./dto";

export interface ProcessingOptions {
  extractProperties: boolean;
  validate: boolean;
  preserveStatus: boolean;
}

@Injectable()
export class GeometryService {
  async processGeometries(
    featureCollections: FeatureCollection[],
    options: ProcessingOptions
  ): Promise<GeometryResponseDto[]> {
    const results: GeometryResponseDto[] = [];

    for (const featureCollection of featureCollections) {
      if (featureCollection.type !== "FeatureCollection") {
        throw new BadRequestException("Invalid FeatureCollection type");
      }

      if (!Array.isArray(featureCollection.features) || featureCollection.features.length === 0) {
        throw new BadRequestException("FeatureCollection must contain at least one feature");
      }

      // Group geometries by site_id (like PHP V2)
      const groupedBySite = this.groupGeometriesBySiteId(featureCollection.features);

      for (const [siteId, siteFeatures] of Object.entries(groupedBySite)) {
        // Group by geometry type (like PHP V2)
        const groupedByType = this.groupGeometriesByType(siteFeatures);

        for (const [geometryType, typeFeatures] of Object.entries(groupedByType)) {
          // Validate features based on geometry type
          if (options.validate) {
            this.validateFeatures(typeFeatures, geometryType);
          }

          // TODO: Implement actual geometry creation (will need database integration)
          // For now, return mock UUIDs for testing
          const polygonUuids = await this.createGeojsonModels(typeFeatures, options);

          // TODO: Implement validation of stored geometries
          const errors = await this.validateStoredGeometries(polygonUuids);

          results.push({
            site_id: siteId,
            geometry_type: geometryType,
            polygon_uuids: polygonUuids,
            errors: Object.keys(errors).length === 0 ? {} : errors
          });
        }
      }
    }

    return results;
  }

  private groupGeometriesBySiteId(features: Feature[]): Record<string, Feature[]> {
    const grouped: Record<string, Feature[]> = {};

    for (const feature of features) {
      const siteId = feature.properties?.site_id;
      if (siteId == null || siteId === "") {
        throw new BadRequestException("All features must have a site_id property");
      }

      if (!(siteId in grouped)) {
        grouped[siteId] = [];
      }
      grouped[siteId].push(feature);
    }

    return grouped;
  }

  private groupGeometriesByType(features: Feature[]): Record<string, Feature[]> {
    const grouped: Record<string, Feature[]> = {};

    for (const feature of features) {
      const geometryType = feature.geometry?.type;
      if (geometryType == null) {
        throw new BadRequestException("All features must have a valid geometry type");
      }

      if (geometryType !== "Point" && geometryType !== "Polygon") {
        throw new BadRequestException(
          `Unsupported geometry type: ${geometryType}. Only Point and Polygon are supported.`
        );
      }

      if (!(geometryType in grouped)) {
        grouped[geometryType] = [];
      }
      grouped[geometryType].push(feature);
    }

    return grouped;
  }

  private validateFeatures(features: Feature[], geometryType: string): void {
    for (const feature of features) {
      // Validate Point-specific requirements
      if (geometryType === "Point") {
        const estArea = feature.properties?.est_area;
        if (estArea == null) {
          throw new BadRequestException("Point features must have est_area property");
        }
        if (typeof estArea !== "number" || estArea < 0.0001) {
          throw new BadRequestException("Point features must have est_area >= 0.0001");
        }
      }

      // Validate site_id is present (required for all types)
      const siteId = feature.properties?.site_id;
      if (siteId == null || siteId === "") {
        throw new BadRequestException("All features must have site_id property");
      }
    }
  }

  private async createGeojsonModels(features: Feature[], options: ProcessingOptions): Promise<string[]> {
    // TODO: Implement actual database creation
    // This should integrate with the existing polygon/geometry creation logic

    // For now, return mock UUIDs for testing
    return features.map((_, index) => `mock-uuid-${Date.now()}-${index}`);
  }

  private async validateStoredGeometries(polygonUuids: string[]): Promise<Record<string, unknown>> {
    // TODO: Implement actual stored geometry validation
    // This should validate the created geometries against business rules

    // For now, return empty errors (success case)
    return {};
  }
}
