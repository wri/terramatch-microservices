import { CalculateIndicator } from "../calculate-indicator.interface";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";

export class RestorationByStrategyCalculator implements CalculateIndicator {
  private logger = new TMLogger(RestorationByStrategyCalculator.name);

  async calculate(polygonUuid: string, geometry: Polygon, dataApiService: DataApiService): Promise<number> {
    this.logger.debug(`Calculating restoration by strategy for polygon ${polygonUuid}`);
    this.logger.debug(`Geometry: ${JSON.stringify(geometry)}`);

    // change this to a query later
    const polygon = await PolygonGeometry.findOne({ where: { uuid: polygonUuid }, attributes: ["uuid"] });
    if (polygon == null) {
      throw new NotFoundException(`Polygon not found for uuid ${polygonUuid}`);
    }
    const sitePolygon = await SitePolygon.findOne({
      where: { polygonUuid: polygon.uuid },
      attributes: ["practice", "calc_area"]
    });
    this.logger.debug(`Site polygon: ${JSON.stringify(sitePolygon)}`);
    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for uuid ${polygonUuid}`);
    }
    const area = await this.calculateArea(sitePolygon, geometry);
    return Promise.resolve(area);
  }

  private async calculateArea(sitePolygon: SitePolygon, geometry: Polygon): Promise<number> {
    if (sitePolygon.calcArea != null) {
      return sitePolygon.calcArea;
    }
    const area = await PolygonGeometry.calculateArea(geometry);
    return area ?? 0;
  }
}
