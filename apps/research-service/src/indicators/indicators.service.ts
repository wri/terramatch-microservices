import { Injectable, NotFoundException } from "@nestjs/common";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import {
  IndicatorOutputHectares,
  IndicatorOutputTreeCoverLoss,
  PolygonGeometry
} from "@terramatch-microservices/database/entities";
import { DataApiService } from "@terramatch-microservices/data-api";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";

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

  process(slug: IndicatorSlug, polygonUuids: string[]) {
    const results: any[] = polygonUuids.map(polygonUuid => {
      return this.processPolygon(slug, polygonUuid);
    });
    this.saveResults(results);
  }

  async processPolygon(slug: IndicatorSlug, polygonUuid: string) {
    const geoJson = await PolygonGeometry.getGeoJSONParsed(polygonUuid);
    if (geoJson == null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }
    this.logger.debug(`GeoJSON: ${JSON.stringify(slugMappings)}`);
    this.logger.debug(`Slug: ${slug}`);
    const slugMappedValue = slugMappings[slug];
    if (slugMappedValue == null) {
      throw new NotFoundException(`Slug ${slug} not found`);
    }

    this.logger.debug(`Getting indicators dataset for slug ${slug} and polygon ${polygonUuid}`);
    this.logger.debug(`GeoJSON: ${JSON.stringify(geoJson)}`);
    const results = await this.dataApiService.getIndicatorsDataset(
      slugMappedValue.indicator,
      slugMappedValue.sql,
      geoJson
    );
    this.logger.debug(`Results: ${JSON.stringify(results)}`);
    return results;
  }

  saveResults(results: any[]) {}
}
