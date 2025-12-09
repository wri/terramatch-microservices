import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { INDICATORS, IndicatorSlug } from "@terramatch-microservices/database/constants";
import {
  IndicatorOutputHectares,
  IndicatorOutputTreeCoverLoss,
  PolygonGeometry,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { DataApiService } from "@terramatch-microservices/data-api";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { CalculateIndicator } from "./calculate-indicator.interface";
import { TreeCoverLossCalculator } from "./calculators/tree-cover-loss.calculator";
import { TreeCoverLossFiresCalculator } from "./calculators/tree-cover-loss-fires.calculator";
import { RestorationByEcoRegionCalculator } from "./calculators/restoration-by-eco-region.calculator";
import { RestorationByTypeCalculator } from "./calculators/restoration-by-type.calculator";
import { Polygon } from "geojson";
import { INDICATOR_MODEL_CLASSES } from "../site-polygons/site-polygon-query.builder";
import { ModelPropertiesAccessor } from "@nestjs/swagger/dist/services/model-properties-accessor";
import { Type } from "@nestjs/common";
import { pick } from "lodash";
import { INDICATOR_DTOS } from "../site-polygons/dto/indicators.dto";
import { IndicatorDto } from "../site-polygons/dto/site-polygon.dto";

export const CALCULATE_INDICATORS: Record<string, CalculateIndicator> = {
  treeCoverLoss: new TreeCoverLossCalculator(),
  treeCoverLossFires: new TreeCoverLossFiresCalculator(),
  restorationByEcoRegion: new RestorationByEcoRegionCalculator(),
  restorationByStrategy: new RestorationByTypeCalculator("practice", INDICATORS[5]),
  restorationByLandUse: new RestorationByTypeCalculator("targetSys", INDICATORS[6])
};

const SLUG_MAPPINGS = {
  treeCoverLoss: IndicatorOutputTreeCoverLoss,
  treeCoverLossFires: IndicatorOutputTreeCoverLoss,
  restorationByEcoRegion: IndicatorOutputHectares,
  restorationByStrategy: IndicatorOutputHectares,
  restorationByLandUse: IndicatorOutputHectares
};
@Injectable()
export class IndicatorsService {
  private readonly logger = new TMLogger(IndicatorsService.name);

  constructor(private readonly dataApiService: DataApiService) {}

  async process(slug: IndicatorSlug, polygonUuids: string[]) {
    const results = await Promise.all(polygonUuids.map(polygonUuid => this.processPolygon(slug, polygonUuid)));
    await this.saveResults(results, slug);
  }

  async processPolygon(
    slug: IndicatorSlug,
    polygonUuid: string
  ): Promise<Partial<IndicatorOutputHectares> | Partial<IndicatorOutputTreeCoverLoss>> {
    const calculator = CALCULATE_INDICATORS[slug];
    if (calculator == null) {
      throw new BadRequestException(`Unknown calculator: ${slug}`);
    }

    const geoJson: Polygon | undefined = await PolygonGeometry.getGeoJSONParsed(polygonUuid);
    if (geoJson == null) {
      throw new NotFoundException(`Polygon with UUID ${polygonUuid} not found`);
    }

    const results = await calculator.calculate(polygonUuid, geoJson, this.dataApiService);
    return results as Partial<IndicatorOutputHectares> | Partial<IndicatorOutputTreeCoverLoss>;
  }

  async saveResults(
    results: Array<Partial<IndicatorOutputHectares> | Partial<IndicatorOutputTreeCoverLoss>>,
    slug: IndicatorSlug
  ) {
    try {
      await SLUG_MAPPINGS[slug].bulkCreate(results, {
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

  /**
   * Get indicator data for a specific entity (site polygon) and indicator slug.
   * Returns all indicator records matching the slug for the given site polygon.
   */
  async getIndicatorData(entityUuid: string, slug: IndicatorSlug): Promise<IndicatorDto[]> {
    const sitePolygon = await SitePolygon.findOne({
      where: { uuid: entityUuid },
      attributes: ["id", "plantStart"]
    });

    if (sitePolygon == null) {
      throw new NotFoundException(`Site polygon not found for UUID: ${entityUuid}`);
    }

    const IndicatorClass = INDICATOR_MODEL_CLASSES[slug];
    if (IndicatorClass == null) {
      throw new BadRequestException(`Unknown indicator slug: ${slug}`);
    }

    const indicators = await IndicatorClass.findAll({
      where: {
        sitePolygonId: sitePolygon.id,
        indicatorSlug: slug
      },
      order: [["yearOfAnalysis", "DESC"]]
    });

    if (indicators.length === 0) {
      return [];
    }

    const accessor = new ModelPropertiesAccessor();
    const DTO = INDICATOR_DTOS[slug];
    const fields = accessor.getModelProperties(DTO.prototype as unknown as Type<unknown>);

    const results: IndicatorDto[] = indicators.map(indicator => {
      let dto = pick(indicator, fields) as IndicatorDto;

      // Filter tree cover loss values based on plant start year (same logic as in site-polygons.service.ts)
      if (
        (dto.indicatorSlug === "treeCoverLoss" || dto.indicatorSlug === "treeCoverLossFires") &&
        dto.value != null &&
        sitePolygon.plantStart != null
      ) {
        const plantStartYear = new Date(sitePolygon.plantStart).getFullYear();
        const startYear = plantStartYear - 10;
        const endYear = plantStartYear;
        dto = {
          ...dto,
          value: Object.fromEntries(
            Object.entries(dto.value).filter(([year]) => {
              const y = parseInt(year, 10);
              return y >= startYear && y <= endYear;
            })
          )
        };
      }

      return dto;
    });

    return results;
  }
}
