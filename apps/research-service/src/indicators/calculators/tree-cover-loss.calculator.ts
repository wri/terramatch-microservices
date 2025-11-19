import { Polygon } from "geojson";
import { CalculateIndicator } from "../calculate-indicator.interface";
import { DataApiService } from "@terramatch-microservices/data-api";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

export class TreeCoverLossCalculator implements CalculateIndicator {
  private logger = new TMLogger(TreeCoverLossCalculator.name);

  private SQL = "SELECT umd_tree_cover_loss__year, SUM(area__ha) FROM results GROUP BY umd_tree_cover_loss__year";
  private INDICATOR = "umd_tree_cover_loss";

  async calculate(polygonUuid: string, geometry: Polygon, dataApiService: DataApiService): Promise<number> {
    this.logger.debug(`Calculating tree cover loss for polygon ${polygonUuid}`);
    const results: unknown[] = await dataApiService.getIndicatorsDataset(this.INDICATOR, this.SQL, geometry);
    return Promise.resolve(results.length);
  }
}
