import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { INDICATORS, IndicatorSlug } from "@terramatch-microservices/database/constants";
import {
  IndicatorOutputHectares,
  IndicatorOutputTreeCover,
  IndicatorOutputTreeCoverLoss,
  PolygonGeometry,
  Project,
  Site,
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
import { Op } from "sequelize";
import { stringify } from "csv-stringify/sync";
import { PolicyService } from "@terramatch-microservices/common";
import { intersection } from "lodash";

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

const DEFAULT_EXPORT_HEADERS: Record<string, string> = {
  poly_name: "Polygon Name",
  size: "Size (ha)",
  site_name: "Site Name",
  status: "Status",
  plantstart: "Plant Start Date"
};

const EXPORT_CONFIGS: Record<string, { columns: Record<string, string>; title: string }> = {
  treeCoverLoss: { columns: { ...DEFAULT_EXPORT_HEADERS }, title: "Tree Cover Loss" },
  treeCoverLossFires: { columns: { ...DEFAULT_EXPORT_HEADERS }, title: "Tree Cover Loss from Fire" },
  restorationByStrategy: {
    columns: { ...DEFAULT_EXPORT_HEADERS, created_at: "Baseline" },
    title: "Hectares Under Restoration By Strategy"
  },
  restorationByLandUse: {
    columns: { ...DEFAULT_EXPORT_HEADERS, created_at: "Baseline" },
    title: "Hectares Under Restoration By Target Land Use System"
  },
  restorationByEcoRegion: {
    columns: { ...DEFAULT_EXPORT_HEADERS, created_at: "Baseline" },
    title: "Hectares Under Restoration By WWF EcoRegion"
  },
  treeCover: {
    columns: {
      ...DEFAULT_EXPORT_HEADERS,
      percent_cover: "Percent Cover",
      project_phase: "Project Phase",
      plus_minus_percent: "Plus Minus Percent"
    },
    title: "Tree Cover"
  }
};

@Injectable()
export class IndicatorsService {
  private readonly logger = new TMLogger(IndicatorsService.name);

  constructor(private readonly dataApiService: DataApiService, private readonly policyService: PolicyService) {}

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

  async exportIndicatorToCsv(
    entityType: "sites" | "projects",
    entityUuid: string,
    slug: IndicatorSlug
  ): Promise<string> {
    this.logger.debug(`Exporting indicator ${slug} for ${entityType} ${entityUuid}`);

    const config = this.getExportConfig(slug);
    if (config == null) {
      throw new NotFoundException(`Indicator slug ${slug} not found or not supported for export`);
    }

    if (entityType === "sites") {
      const attributes = intersection(
        ["id", "uuid", "frameworkKey", "projectId", "status"],
        Object.keys(Site.getAttributes())
      );
      const site = await Site.findOne({ where: { uuid: entityUuid }, attributes });
      if (site == null) throw new NotFoundException(`Site not found for uuid: ${entityUuid}`);
      await this.policyService.authorize("read", site);
    } else {
      const attributes = intersection(
        ["id", "uuid", "frameworkKey", "organisationId", "status"],
        Object.keys(Project.getAttributes())
      );
      const project = await Project.findOne({ where: { uuid: entityUuid }, attributes });
      if (project == null) throw new NotFoundException(`Project not found for uuid: ${entityUuid}`);
      await this.policyService.authorize("read", project);
    }

    const polygons = await this.getPolygonsForEntity(entityType, entityUuid);
    if (polygons.length === 0) {
      this.logger.warn(`No polygons found for ${entityType} ${entityUuid}`);
      return this.generateEmptyCsv(config.columns);
    }

    const rows = await this.getPolygonIndicatorData(polygons, slug);
    return this.generateCsv(rows, config, slug);
  }

  private getExportConfig(slug: IndicatorSlug) {
    return EXPORT_CONFIGS[slug] ?? null;
  }

  private async getPolygonsForEntity(entityType: "sites" | "projects", entityUuid: string): Promise<SitePolygon[]> {
    let siteUuids: string[];

    if (entityType === "sites") {
      const site = await Site.findOne({ where: { uuid: entityUuid }, attributes: ["uuid"] });
      if (site == null) throw new NotFoundException(`Site not found for uuid: ${entityUuid}`);
      siteUuids = [site.uuid];
    } else {
      const project = await Project.findOne({ where: { uuid: entityUuid }, attributes: ["id"] });
      if (project == null) throw new NotFoundException(`Project not found for uuid: ${entityUuid}`);
      const sites = await Site.findAll({ where: { projectId: project.id }, attributes: ["uuid"] });
      siteUuids = sites.map(site => site.uuid);
    }

    if (siteUuids.length === 0) return [];

    return await SitePolygon.findAll({
      where: { siteUuid: { [Op.in]: siteUuids }, isActive: true, status: "approved" },
      include: [{ model: Site, attributes: ["name"] }],
      attributes: ["id", "polyName", "status", "plantStart", "calcArea"]
    });
  }

  private async getPolygonIndicatorData(polygons: SitePolygon[], slug: IndicatorSlug) {
    const rows: Array<Record<string, string | number | Date | null>> = [];

    for (const polygon of polygons) {
      const indicator = await this.getIndicatorForPolygon(polygon.id, slug);
      if (indicator == null) continue;

      const row: Record<string, string | number | Date | null> = {
        poly_name: polygon.polyName,
        status: polygon.status,
        plantstart: polygon.plantStart,
        site_name: polygon.site?.name ?? "",
        size: polygon.calcArea ?? 0,
        created_at: indicator.createdAt ?? null
      };

      if (slug === "treeCoverLoss" || slug === "treeCoverLossFires") {
        const valueYears = (indicator as IndicatorOutputTreeCoverLoss).value as Record<string, number>;
        if (valueYears != null) {
          Object.keys(valueYears)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .forEach(year => {
              row[year] = valueYears[year] ?? 0;
            });
        }
      } else if (slug === "restorationByEcoRegion") {
        const values = (indicator as IndicatorOutputHectares).value as Record<string, string | number>;
        Object.assign(row, this.getCategoryEcoRegion(values));
      } else if (slug === "restorationByLandUse" || slug === "restorationByStrategy") {
        const values = (indicator as IndicatorOutputHectares).value as Record<string, number>;
        Object.assign(row, this.processValuesHectares(values));
      } else if (slug === "treeCover") {
        const tcIndicator = indicator as IndicatorOutputTreeCover;
        row.percent_cover = tcIndicator.percentCover ?? null;
        row.project_phase = tcIndicator.projectPhase ?? null;
        row.plus_minus_percent = tcIndicator.plusMinusPercent ?? null;
      }

      rows.push(row);
    }

    return rows;
  }

  private async getIndicatorForPolygon(polygonId: number, slug: IndicatorSlug) {
    if (slug === "treeCoverLoss" || slug === "treeCoverLossFires") {
      return await IndicatorOutputTreeCoverLoss.findOne({
        where: { sitePolygonId: polygonId, indicatorSlug: slug },
        attributes: ["indicatorSlug", "yearOfAnalysis", "value", "createdAt"],
        order: [["createdAt", "DESC"]]
      });
    } else if (
      slug === "restorationByStrategy" ||
      slug === "restorationByLandUse" ||
      slug === "restorationByEcoRegion"
    ) {
      return await IndicatorOutputHectares.findOne({
        where: { sitePolygonId: polygonId, indicatorSlug: slug },
        attributes: ["indicatorSlug", "yearOfAnalysis", "value", "createdAt"],
        order: [["createdAt", "DESC"]]
      });
    } else if (slug === "treeCover") {
      return await IndicatorOutputTreeCover.findOne({
        where: { sitePolygonId: polygonId, indicatorSlug: slug },
        attributes: [
          "indicatorSlug",
          "yearOfAnalysis",
          "percentCover",
          "projectPhase",
          "plusMinusPercent",
          "createdAt"
        ],
        order: [["createdAt", "DESC"]]
      });
    }
    return null;
  }

  private getCategoryEcoRegion(values: Record<string, string | number>): Record<string, string | number> {
    const ecoRegionMap: Record<string, string> = {
      australasian: "Australasian",
      afrotropical: "Afrotropical",
      palearctic: "Palearctic",
      nearctic: "Nearctic",
      neotropical: "Neotropical",
      indomalayan: "Indomalayan",
      oceanian: "Oceanian",
      antarctic: "Antarctic"
    };

    const result: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(values)) {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey === "realm") {
        result.realm = value;
      } else {
        const mappedKey = ecoRegionMap[lowerKey] ?? key;
        result[mappedKey] = typeof value === "number" ? parseFloat(value.toFixed(3)) : value;
      }
    }
    return result;
  }

  private processValuesHectares(values: Record<string, number>): Record<string, number> {
    const separateKeys: Record<string, number> = {};
    for (const [key, value] of Object.entries(values)) {
      key
        .split(",")
        .map(item => item.trim().replace(/-/g, "_"))
        .forEach(item => {
          separateKeys[item] = parseFloat(value.toFixed(3));
        });
    }
    return separateKeys;
  }

  private generateCsv(
    rows: Array<Record<string, string | number | Date | null>>,
    config: { columns: Record<string, string> },
    slug: IndicatorSlug
  ): string {
    if (rows.length === 0) return this.generateEmptyCsv(config.columns);

    const columnsArray: Array<{ key: string; header: string }> = [];

    Object.entries(config.columns).forEach(([key, header]) => {
      columnsArray.push({ key, header });
    });

    if (slug === "treeCoverLoss" || slug === "treeCoverLossFires") {
      const allYears = new Set<number>();
      rows.forEach(row => {
        Object.keys(row).forEach(key => {
          const yearNum = parseInt(key);
          if (!isNaN(yearNum) && yearNum >= 2000) allYears.add(yearNum);
        });
      });

      Array.from(allYears)
        .sort((a, b) => a - b)
        .forEach(year => {
          const yearStr = year.toString();
          columnsArray.push({ key: yearStr, header: yearStr });
        });
    }

    if (slug === "restorationByEcoRegion" || slug === "restorationByStrategy" || slug === "restorationByLandUse") {
      if (rows.length > 0) {
        Object.keys(rows[0]).forEach(key => {
          if (!columnsArray.some(col => col.key === key)) {
            const header = key
              .split("_")
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");
            columnsArray.push({ key, header });
          }
        });
      }
    }

    const filteredRows = rows.map(row => {
      const filteredRow: Record<string, string | number> = {};
      columnsArray.forEach(({ key }) => {
        const value = row[key];
        filteredRow[key] = value instanceof Date ? value.toISOString().split("T")[0] : value == null ? "" : value;
      });
      return filteredRow;
    });

    return stringify(filteredRows, { header: true, columns: columnsArray });
  }

  private generateEmptyCsv(columns: Record<string, string>): string {
    const columnsArray = Object.entries(columns).map(([key, header]) => ({ key, header }));
    return stringify([], { header: true, columns: columnsArray });
  }
}
