import { Injectable, InternalServerErrorException, NotFoundException } from "@nestjs/common";
import { FeatureCollection } from "geojson";
import { CreationAttributes } from "sequelize";
import { AnrPlotGeometry } from "@terramatch-microservices/database/entities";

@Injectable()
export class AnrPlotGeometryService {
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
