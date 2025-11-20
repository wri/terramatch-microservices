import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { INDICATORS, IndicatorSlug } from "@terramatch-microservices/database/constants";
import {
  IndicatorOutputHectares,
  IndicatorOutputTreeCoverLoss,
  PolygonGeometry
} from "@terramatch-microservices/database/entities";
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
  restorationByStrategy: new RestorationByTypeCalculator("practice", INDICATORS[5]),
  restorationByLandUse: new RestorationByTypeCalculator("targetSys", INDICATORS[6])
};

const slugMappings = {
  treeCoverLoss: {
    sql: "SELECT umd_tree_cover_loss__year, SUM(area__ha) FROM results GROUP BY umd_tree_cover_loss__year",
    query_url: "/dataset/umd_tree_cover_loss/latest/query",
    indicator: "umd_tree_cover_loss",
    model: IndicatorOutputTreeCoverLoss,
    table_name: "indicator_output_tree_cover_loss"
  },
  treeCoverLossFires: {
    sql: "SELECT umd_tree_cover_loss_from_fires__year, SUM(area__ha) FROM results GROUP BY umd_tree_cover_loss_from_fires__year",
    query_url: "/dataset/umd_tree_cover_loss_from_fires/latest/query",
    indicator: "umd_tree_cover_loss_from_fires",
    model: IndicatorOutputTreeCoverLoss,
    table_name: "indicator_output_tree_cover_loss"
  },
  restorationByEcoRegion: {
    sql: "SELECT eco_name, realm FROM results",
    indicator: "wwf_terrestrial_ecoregions",
    model: IndicatorOutputHectares,
    table_name: "indicator_output_hectares"
  },
  restorationByStrategy: {
    indicator: "restoration_practice",
    model: IndicatorOutputHectares,
    table_name: "indicator_output_hectares"
  },
  restorationByLandUse: {
    indicator: "target_system",
    model: IndicatorOutputHectares,
    table_name: "indicator_output_hectares"
  }
};
@Injectable()
export class IndicatorsService {
  private readonly logger = new TMLogger(IndicatorsService.name);

  constructor(private readonly dataApiService: DataApiService) {}

  async process(slug: IndicatorSlug, polygonUuids: string[]) {
    const results = await Promise.all(polygonUuids.map(polygonUuid => this.processPolygon(slug, polygonUuid)));
    this.saveResults(results, slug);
  }

  async processPolygon(
    slug: IndicatorSlug,
    polygonUuid: string
  ): Promise<Partial<IndicatorOutputHectares> | Partial<IndicatorOutputTreeCoverLoss>> {
    const calculator = CALCULATE_INDICATORS[slug];
    if (calculator == null || calculator.calculate == null) {
      throw new BadRequestException(`Unknown calculator: ${slug}`);
    }

    const geoJson: Polygon | undefined = await PolygonGeometry.getGeoJSONParsed(polygonUuid);
    if (geoJson == undefined) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }

    const results = await calculator.calculate(polygonUuid, geoJson, this.dataApiService);
    return results as Partial<IndicatorOutputHectares> | Partial<IndicatorOutputTreeCoverLoss>;
  }

  async saveResults(
    results: Array<Partial<IndicatorOutputHectares> | Partial<IndicatorOutputTreeCoverLoss>>,
    slug: IndicatorSlug
  ) {
    const slugMappedValue = slugMappings[slug];

    try {
      await slugMappedValue.model.bulkCreate(results, {
        updateOnDuplicate: ["value", "updatedAt"],
        ignoreDuplicates: false,
        returning: true
      });
      this.logger.debug(`Successfully saved/updated ${results.length} results for slug: ${slug}`);
    } catch (error) {
      this.logger.error(`Failed to save results for slug: ${slug}`, `${error}`);
      throw error;
    }
  }
}
