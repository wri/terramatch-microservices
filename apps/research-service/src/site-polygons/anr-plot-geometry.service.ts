import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FeatureCollection } from "geojson";
import { CreationAttributes } from "sequelize";
import { AnrPlotGeometry, SitePolygon } from "@terramatch-microservices/database/entities";

export const ANR_MONITORING_PLOTS_REQUIRED_PRACTICE = "assisted-natural-regeneration";

@Injectable()
export class AnrPlotGeometryService {
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
