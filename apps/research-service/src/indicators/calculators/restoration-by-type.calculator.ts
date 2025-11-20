import { CalculateIndicator } from "../calculate-indicator.interface";
import { Polygon } from "geojson";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { IndicatorOutputHectares, PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";
import { IndicatorSlug, RestorationByTypeData } from "@terramatch-microservices/database/constants";

export class RestorationByTypeCalculator implements CalculateIndicator {
  constructor(private readonly type: string, private readonly indicatorSlug: IndicatorSlug) {}
  private logger = new TMLogger(RestorationByTypeCalculator.name);

  async calculate(polygonUuid: string, geometry: Polygon): Promise<IndicatorOutputHectares> {
    this.logger.debug(`Calculating restoration by ${this.type} for polygon ${polygonUuid}`);
    this.logger.debug(`Geometry: ${JSON.stringify(geometry)}`);

    const sitePolygon = await SitePolygon.findOne({
      where: {
        polygonUuid: {
          [Op.eq]: PolygonGeometry.uuidSubquery(polygonUuid)
        }
      },
      attributes: ["id", this.type, "calcArea"]
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for uuid ${polygonUuid}`);
    }

    const area = await this.calculateArea(sitePolygon, geometry);

    this.logger.debug(`sitePolygon[this.type]: ${sitePolygon}`);

    const restorationByValue: RestorationByTypeData = {
      [sitePolygon[this.type].join(",")]: area
    };

    const restorationByTypeData: Partial<IndicatorOutputHectares> = {
      sitePolygonId: sitePolygon.id,
      indicatorSlug: this.indicatorSlug,
      yearOfAnalysis: new Date().getFullYear(),
      value: restorationByValue
    };

    return restorationByTypeData as IndicatorOutputHectares;
  }

  private async calculateArea(sitePolygon: SitePolygon, geometry: Polygon): Promise<number> {
    if (sitePolygon.calcArea != null) {
      return sitePolygon.calcArea;
    }
    const area = await PolygonGeometry.calculateArea(geometry);
    return area ?? 0;
  }
}
