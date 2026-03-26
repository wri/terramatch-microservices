import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FeatureCollection } from "geojson";
import { CreationAttributes } from "sequelize";
import { AnrPlotGeometry, SitePolygon } from "@terramatch-microservices/database/entities";

export const ANR_MONITORING_PLOTS_REQUIRED_PRACTICE = "assisted-natural-regeneration";

const ANR_PLOT_FEATURE_PROPERTY_KEYS = new Set(["plotId", "areaM2", "select"]);

@Injectable()
export class AnrPlotGeometryService {
  private assertAnrPlotFeatureCollection(featureCollection: FeatureCollection): void {
    featureCollection.features.forEach((feature, index) => {
      const props = feature.properties as unknown;
      if (props == null) return;
      if (typeof props !== "object" || Array.isArray(props)) {
        throw new BadRequestException(
          `ANR plot GeoJSON feature at index ${index} has invalid properties (expected an object or null).`
        );
      }
      const raw = props as Record<string, unknown>;
      for (const key of Object.keys(raw)) {
        if (ANR_PLOT_FEATURE_PROPERTY_KEYS.has(key)) continue;
        if (key === "plot_id" || key === "area_m2") {
          throw new BadRequestException(
            "ANR plot GeoJSON must use camelCase: plotId, areaM2, select (snake_case is not accepted)."
          );
        }
        throw new BadRequestException(`Invalid ANR plot property key "${key}". Allowed: plotId, areaM2, select.`);
      }
      if ("plotId" in raw && raw.plotId !== undefined) {
        if (typeof raw.plotId !== "number" || !Number.isFinite(raw.plotId)) {
          throw new BadRequestException(
            `ANR plot feature at index ${index}: plotId must be a finite number when provided.`
          );
        }
      }
      if ("areaM2" in raw && raw.areaM2 !== undefined) {
        if (typeof raw.areaM2 !== "number" || !Number.isFinite(raw.areaM2)) {
          throw new BadRequestException(
            `ANR plot feature at index ${index}: areaM2 must be a finite number when provided.`
          );
        }
      }
      if ("select" in raw && raw.select != null && typeof raw.select !== "string") {
        throw new BadRequestException(
          `ANR plot feature at index ${index}: select must be a string or null when provided.`
        );
      }
    });
  }

  assertSitePolygonEligibleForAnrPlotGeometry(sitePolygon: SitePolygon): void {
    if (sitePolygon.status !== "approved") {
      throw new BadRequestException("ANR monitoring plots are only available for site polygons with approved status.");
    }
    const practices = sitePolygon.practice ?? [];
    if (!practices.includes(ANR_MONITORING_PLOTS_REQUIRED_PRACTICE)) {
      throw new BadRequestException(
        "ANR monitoring plots require the assisted-natural-regeneration restoration practice on the site polygon."
      );
    }
  }

  async requireSitePolygonEligibleForAnrPlots(sitePolygonUuid: string): Promise<SitePolygon> {
    const sitePolygon = await SitePolygon.findOne({ where: { uuid: sitePolygonUuid } });
    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found: ${sitePolygonUuid}`);
    }
    this.assertSitePolygonEligibleForAnrPlotGeometry(sitePolygon);
    return sitePolygon;
  }

  async getPlot(sitePolygonId: number): Promise<AnrPlotGeometry | null> {
    return AnrPlotGeometry.findOne({ where: { sitePolygonId } });
  }

  async requirePlot(sitePolygonId: number): Promise<AnrPlotGeometry> {
    const plot = await this.getPlot(sitePolygonId);
    if (plot == null) {
      throw new NotFoundException(`No ANR plot geometry found for site polygon id ${sitePolygonId}`);
    }
    return plot;
  }

  async upsertPlot(
    sitePolygonId: number,
    featureCollection: FeatureCollection,
    userId: number
  ): Promise<AnrPlotGeometry> {
    this.assertAnrPlotFeatureCollection(featureCollection);
    return AnrPlotGeometry.sql.transaction(async transaction => {
      await AnrPlotGeometry.destroy({ where: { sitePolygonId }, transaction });

      return AnrPlotGeometry.create(
        {
          sitePolygonId,
          geojson: featureCollection as object,
          plotCount: featureCollection.features.length,
          createdBy: userId
        } as CreationAttributes<AnrPlotGeometry>,
        { transaction }
      );
    });
  }

  async deletePlot(sitePolygonId: number): Promise<void> {
    await AnrPlotGeometry.destroy({ where: { sitePolygonId } });
  }
}
