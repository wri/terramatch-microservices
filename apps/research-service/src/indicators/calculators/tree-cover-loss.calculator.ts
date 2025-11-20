import { Polygon } from "geojson";
import { CalculateIndicator } from "../calculate-indicator.interface";
import { DataApiService } from "@terramatch-microservices/data-api";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { INDICATORS, TreeCoverLossData, TreeCoverLossResult } from "@terramatch-microservices/database/constants";
import { NotFoundException } from "@nestjs/common";
import { IndicatorOutputTreeCoverLoss, SitePolygon } from "@terramatch-microservices/database/entities";

export class TreeCoverLossCalculator implements CalculateIndicator {
  private logger = new TMLogger(TreeCoverLossCalculator.name);

  private SQL = "SELECT umd_tree_cover_loss__year, SUM(area__ha) FROM results GROUP BY umd_tree_cover_loss__year";
  private INDICATOR = "umd_tree_cover_loss";

  async calculate(
    polygonUuid: string,
    geometry: Polygon,
    dataApiService: DataApiService
  ): Promise<IndicatorOutputTreeCoverLoss> {
    this.logger.debug(`Calculating tree cover loss for polygon ${polygonUuid}`);
    const results: TreeCoverLossResult[] = await dataApiService.getIndicatorsDataset(
      this.INDICATOR,
      this.SQL,
      geometry
    );

    const sitePolygon = await SitePolygon.findOne({
      where: {
        polygonUuid: polygonUuid
      },
      attributes: ["id"]
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for uuid ${polygonUuid}`);
    }

    const treeCoverLossValue: TreeCoverLossData = results.reduce((acc, result) => {
      acc[result.umd_tree_cover_loss__year] = result.area__ha;
      return acc;
    }, {} as TreeCoverLossData);

    const treeCoverLossData: Partial<IndicatorOutputTreeCoverLoss> = {
      sitePolygonId: sitePolygon.id,
      indicatorSlug: INDICATORS[2],
      yearOfAnalysis: new Date().getFullYear(),
      value: treeCoverLossValue
    };

    return treeCoverLossData as IndicatorOutputTreeCoverLoss;
  }
}
