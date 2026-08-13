import { CalculateIndicator } from "../calculate-indicator.interface";
import { DataApiService } from "@terramatch-microservices/data-api";
import { Polygon } from "geojson";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { INDICATORS, TreeCoverLossFiresResult } from "@terramatch-microservices/database/constants";
import { assertValidPlantStart, buildTreeCoverLossValue } from "./tree-cover-loss-value.util";
import { IndicatorOutputTreeCoverLoss, SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { Op } from "sequelize";

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

    const sitePolygon = await SitePolygon.findOne({
      where: {
        polygonUuid: { [Op.eq]: polygonUuid },
        isActive: true,
        status: "approved"
      },
      attributes: ["id", "plantStart"]
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for uuid ${polygonUuid}`);
    }

    const plantStart = assertValidPlantStart(sitePolygon.plantStart, polygonUuid);

    const results: TreeCoverLossFiresResult[] = await dataApiService.getIndicatorsDataset(
      this.INDICATOR,
      this.SQL,
      geometry
    );

    const yearOfAnalysis = new Date().getFullYear();
    const treeCoverLossFiresValue = buildTreeCoverLossValue(
      results,
      result => result.umd_tree_cover_loss_from_fires__year + 2000,
      plantStart
    );

    const treeCoverLossFiresData: Partial<IndicatorOutputTreeCoverLoss> = {
      sitePolygonId: sitePolygon.id,
      indicatorSlug: INDICATORS[3],
      yearOfAnalysis,
      value: treeCoverLossFiresValue
    };

    return treeCoverLossFiresData as IndicatorOutputTreeCoverLoss;
  }
}
