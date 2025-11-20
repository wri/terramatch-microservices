import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { CalculateIndicator } from "../calculate-indicator.interface";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";
import { PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";

export type EcoRegionResult = {
  [key: string]: string | number;
  realm: string;
};

export class RestorationByEcoRegionCalculator implements CalculateIndicator {
  private logger = new TMLogger(RestorationByEcoRegionCalculator.name);

  private SQL = "SELECT eco_name, realm FROM results";
  private INDICATOR = "wwf_terrestrial_ecoregions";

  async calculate(polygonUuid: string, geometry: Polygon, dataApiService: DataApiService): Promise<EcoRegionResult> {
    this.logger.debug(`Calculating restoration by eco region for polygon ${polygonUuid}`);
    const sitePolygon = await SitePolygon.findOne({
      where: {
        polygonUuid: {
          [Op.eq]: PolygonGeometry.uuidSubquery(polygonUuid)
        }
      },
      attributes: ["calcArea"]
    });
    this.logger.debug(`Site polygon: ${JSON.stringify(sitePolygon)}`);
    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for uuid ${polygonUuid}`);
    }
    const results: EcoRegionResult[] = await dataApiService.getIndicatorsDataset(this.INDICATOR, this.SQL, geometry);

    const area = await this.calculateArea(sitePolygon, geometry);

    const ecoRegiondata = results.map(result => {
      return {
        [result.eco_name]: area,
        realm: result.realm
      };
    }) as EcoRegionResult[];

    const FormattedecoRegiondata = ecoRegiondata.reduce((acc, item) => {
      Object.entries(item).forEach(([key]) => {
        if (key !== "realm") {
          acc[key] = area;
        }
      });
      acc.realm = item.realm;
      return acc;
    }, {} as Record<string, string | number>);
    this.logger.debug(`Eco region data: ${JSON.stringify(FormattedecoRegiondata)}`);

    return FormattedecoRegiondata as EcoRegionResult;
  }

  private async calculateArea(sitePolygon: SitePolygon, geometry: Polygon): Promise<number> {
    if (sitePolygon.calcArea != null) {
      return sitePolygon.calcArea;
    }
    const area = await PolygonGeometry.calculateArea(geometry);
    return area ?? 0;
  }
}
