import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
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

  async getPlot(sitePolygonUuid: string): Promise<AnrPlotGeometry | null> {
    return AnrPlotGeometry.findOne({ where: { sitePolygonUuid } });
  }

  async getPlotOrThrow(sitePolygonUuid: string): Promise<AnrPlotGeometry> {
    const plot = await this.getPlot(sitePolygonUuid);
    if (plot == null) {
      throw new NotFoundException(`No ANR plot geometry found for polygon ${sitePolygonUuid}`);
    }
    return plot;
  }

  async upsertPlot(
    sitePolygonUuid: string,
    featureCollection: FeatureCollection,
    userId: number
  ): Promise<AnrPlotGeometry> {
    if (AnrPlotGeometry.sequelize == null) {
      throw new InternalServerErrorException("Database connection not available");
    }

    return AnrPlotGeometry.sequelize.transaction(async transaction => {
      await AnrPlotGeometry.destroy({ where: { sitePolygonUuid }, transaction });

      return AnrPlotGeometry.create(
        {
          sitePolygonUuid,
          geojson: featureCollection as object,
          plotCount: featureCollection.features.length,
          createdBy: userId
        } as CreationAttributes<AnrPlotGeometry>,
        { transaction }
      );
    });
  }

  async deletePlot(sitePolygonUuid: string): Promise<void> {
    await AnrPlotGeometry.destroy({ where: { sitePolygonUuid } });
  }
}
