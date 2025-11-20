import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import { PolygonGeometry } from "@terramatch-microservices/database/entities";
import { DataApiService } from "@terramatch-microservices/data-api";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { CalculateIndicator } from "./calculate-indicator.interface";
import { TreeCoverLossCalculator } from "./calculators/tree-cover-loss.calculator";
import { TreeCoverLossFiresCalculator } from "./calculators/tree-cover-loss-fires.calculator";
import { RestorationByEcoRegionCalculator } from "./calculators/restoration-by-eco-region.calculator";
import { RestorationByTypeCalculator } from "./calculators/restoration-by-type.calculator";
import { Polygon } from "geojson";

export const CALCULATE_INDICATORS: Record<string, CalculateIndicator> = {
  treeCoverLoss: new TreeCoverLossCalculator(),
  treeCoverLossFires: new TreeCoverLossFiresCalculator(),
  restorationByEcoRegion: new RestorationByEcoRegionCalculator(),
  restorationByStrategy: new RestorationByTypeCalculator("practice"),
  restorationByLandUse: new RestorationByTypeCalculator("targetSystem")
};
@Injectable()
export class IndicatorsService {
  private readonly logger = new TMLogger(IndicatorsService.name);

  constructor(private readonly dataApiService: DataApiService) {}

  process(slug: IndicatorSlug, polygonUuids: string[]) {
    const results: unknown[] = polygonUuids.map(polygonUuid => {
      return this.processPolygon(slug, polygonUuid);
    });
    this.saveResults(results);
  }

  async processPolygon(slug: IndicatorSlug, polygonUuid: string) {
    const calculator = CALCULATE_INDICATORS[slug];
    if (calculator == null || calculator.calculate == null) {
      throw new BadRequestException(`Unknown calculator: ${slug}`);
    }

    const geoJson: Polygon | undefined = await PolygonGeometry.getGeoJSONParsed(polygonUuid);
    if (geoJson == undefined) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }

    const results = await calculator.calculate(polygonUuid, geoJson, this.dataApiService);
    return results;
  }

  saveResults(results: unknown[]) {
    console.log(`Saving results: ${JSON.stringify(results)}`);
  }
}
