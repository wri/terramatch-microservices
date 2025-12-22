import { CalculateIndicator } from "../calculate-indicator.interface";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { INDICATORS, TreeCoverLossData, TreeCoverLossFiresResult } from "@terramatch-microservices/database/constants";
import { IndicatorOutputTreeCoverLoss, SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";

export class TreeCoverLossFiresCalculator implements CalculateIndicator {
  private logger = new TMLogger(TreeCoverLossFiresCalculator.name);

  private SQL =
    "SELECT umd_tree_cover_loss_from_fires__year, SUM(area__ha) FROM results GROUP BY umd_tree_cover_loss_from_fires__year";
  private INDICATOR = "umd_tree_cover_loss_from_fires";

  async calculate(
    polygonUuid: string,
    geometry: Polygon,
    dataApiService: DataApiService
  ): Promise<IndicatorOutputTreeCoverLoss> {
    this.logger.debug(`Calculating tree cover loss fires for polygon ${polygonUuid}`);
    const results: TreeCoverLossFiresResult[] = await dataApiService.getIndicatorsDataset(
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

    const treeCoverLossFiresValue: TreeCoverLossData = results.reduce((acc, result) => {
      acc[result.umd_tree_cover_loss_from_fires__year + 2000] = result.area__ha;
      return acc;
    }, {} as TreeCoverLossData);

    const treeCoverLossFiresData: Partial<IndicatorOutputTreeCoverLoss> = {
      sitePolygonId: sitePolygon.id,
      indicatorSlug: INDICATORS[3],
      yearOfAnalysis: new Date().getFullYear(),
      value: treeCoverLossFiresValue
    };

    return treeCoverLossFiresData as IndicatorOutputTreeCoverLoss;
  }
}
