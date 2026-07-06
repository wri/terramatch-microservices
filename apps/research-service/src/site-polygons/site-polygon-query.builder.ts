import { IncludeOptions, literal, Op, WhereOptions } from "sequelize";
import {
  Disturbance,
  IndicatorOutputFieldMonitoring,
  IndicatorOutputHectares,
  IndicatorOutputMsuCarbon,
  IndicatorOutputTreeCount,
  IndicatorOutputTreeCover,
  IndicatorOutputTreeCoverLoss,
  LandscapeGeometry,
  PolygonGeometry,
  Project,
  Site,
  SitePolygon,
  CriteriaSite
} from "@terramatch-microservices/database/entities";
import { IndicatorSlug, PolygonStatus, VALIDATION_CRITERIA_IDS } from "@terramatch-microservices/database/constants";
import { uniq } from "lodash";
import { BadRequestException } from "@nestjs/common";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { ModelCtor, ModelStatic } from "sequelize-typescript";
import { LandscapeSlug } from "@terramatch-microservices/database/types/landscapeGeometry";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import { SITE_POLYGON_SEARCH_FIELDS, SitePolygonSearchField } from "./dto/site-polygon-query.dto";

type IndicatorModel =
  | IndicatorOutputTreeCover
  | IndicatorOutputTreeCoverLoss
  | IndicatorOutputHectares
  | IndicatorOutputTreeCount
  | IndicatorOutputFieldMonitoring
  | IndicatorOutputMsuCarbon;

type IndicatorClass<T extends IndicatorModel> = ModelCtor<T> & ModelStatic<T>;
export const INDICATOR_MODEL_CLASSES: { [Slug in IndicatorSlug]: IndicatorClass<IndicatorModel> } = {
  treeCover: IndicatorOutputTreeCover,
  treeCoverLoss: IndicatorOutputTreeCoverLoss,
  treeCoverLossFires: IndicatorOutputTreeCoverLoss,
  restorationByEcoRegion: IndicatorOutputHectares,
  restorationByStrategy: IndicatorOutputHectares,
  restorationByLandUse: IndicatorOutputHectares,
  treeCount: IndicatorOutputTreeCount,
  earlyTreeVerification: IndicatorOutputTreeCount,
  fieldMonitoring: IndicatorOutputFieldMonitoring,
  msuCarbon: IndicatorOutputMsuCarbon
};

export class SitePolygonQueryBuilder extends PaginatedQueryBuilder<SitePolygon> {
  private siteJoin: IncludeOptions = {
    model: Site,
    include: [{ association: "project", attributes: ["uuid", "shortName", "name", "level0Project"] }],
    attributes: ["id", "projectId", "name", "ppcExternalId"],
    required: true
  };

  constructor(pageSize?: number) {
    super(SitePolygon, pageSize);

    this.findOptions.include = [
      {
        model: PolygonGeometry,
        attributes: ["polygon"]
      },
      {
        model: Disturbance,
        attributes: ["disturbanceableId"],
        required: false
      },
      this.siteJoin
    ];

    this.where({ isActive: true });
  }

  async excludeTestProjects() {
    // Avoid joining against the entire project table by doing a quick query first. The number of test projects is small
    const testProjects = Subquery.select(Project, "id").eq("isTest", true).literal;
    return this.where({ projectId: { [Op.notIn]: testProjects } }, this.siteJoin);
  }

  async filterSiteUuids(siteUuids: string[]) {
    return this.where({ siteUuid: { [Op.in]: siteUuids } });
  }

  async filterPolygonUuids(polygonUuids: string[]) {
    return this.where({ polygonUuid: { [Op.in]: polygonUuids } });
  }

  async filterProjectAttributes(cohort?: string[], slug?: LandscapeSlug) {
    let landscapeValue: string | null = null;
    if (slug != null) {
      const landscape = await LandscapeGeometry.findOne({ where: { slug }, attributes: ["landscape"] });
      if (landscape == null) {
        throw new BadRequestException(`Unrecognized landscape slug: ${slug}`);
      }
      landscapeValue = landscape.landscape;
    }

    const subquery = Subquery.select(Project, "id");
    if (slug != null && landscapeValue != null) {
      subquery.isNotNull("landscape").eq("landscape", landscapeValue);
    }

    if (cohort != null && cohort.length > 0) {
      const whereConditions: WhereOptions[] = [{ cohort: { [Op.in]: cohort } }];

      if (slug != null && landscapeValue != null) {
        whereConditions.push({ landscape: landscapeValue });
      }

      const projects = await Project.findAll({
        where: {
          [Op.and]: whereConditions
        },
        attributes: ["id"]
      });

      return this.where({ projectId: { [Op.in]: projects.map(p => p.id) } }, this.siteJoin);
    }

    return this.where({ projectId: { [Op.in]: subquery.literal } }, this.siteJoin);
  }

  async filterProjectShortNames(projectShortNames: string[]) {
    const filterProjects = await Project.findAll({
      where: { shortName: { [Op.in]: projectShortNames } },
      attributes: ["id"]
    });
    return this.where({ projectId: { [Op.in]: filterProjects.map(({ id }) => id) } }, this.siteJoin);
  }

  async filterProjectUuids(projectUuids: string[]) {
    const filterProjects = await Project.findAll({
      where: { uuid: { [Op.in]: projectUuids } },
      attributes: ["id"]
    });
    return this.where({ projectId: { [Op.in]: filterProjects.map(({ id }) => id) } }, this.siteJoin);
  }

  async filterValidationStatus(validationStatuses: string[]) {
    const otherStatuses = validationStatuses.filter(status => status !== "not_checked");
    const hasNotChecked = otherStatuses.length !== validationStatuses.length;

    if (hasNotChecked && otherStatuses.length > 0) {
      return this.where({
        [Op.or]: [{ validationStatus: null }, { validationStatus: { [Op.in]: otherStatuses } }]
      });
    } else if (hasNotChecked) {
      return this.where({ validationStatus: null });
    } else {
      return this.where({ validationStatus: { [Op.in]: otherStatuses } });
    }
  }

  async addSearch(searchTerm: string, fields?: SitePolygonSearchField[]) {
    const selectedFields =
      fields != null && fields.length > 0 ? fields : ([...SITE_POLYGON_SEARCH_FIELDS] as SitePolygonSearchField[]);
    const conditions: WhereOptions[] = [];

    if (selectedFields.includes("siteName")) {
      conditions.push({ "$site.name$": { [Op.like]: `${searchTerm}%` } });
      conditions.push({ "$site.name$": { [Op.like]: `%${searchTerm}%` } });
    }

    if (selectedFields.includes("polyName")) {
      conditions.push({ polyName: { [Op.like]: `${searchTerm}%` } });
      conditions.push({ polyName: { [Op.like]: `%${searchTerm}%` } });
    }

    if (selectedFields.includes("polygonUuid")) {
      conditions.push({ polygonUuid: { [Op.like]: `${searchTerm}%` } });
      conditions.push({ polygonUuid: { [Op.like]: `%${searchTerm}%` } });
    }

    if (conditions.length === 0) {
      return this;
    }

    return this.where({ [Op.or]: conditions });
  }

  hasStatuses(polygonStatuses?: PolygonStatus[]) {
    if (polygonStatuses != null) this.where({ status: { [Op.in]: polygonStatuses } });
    return this;
  }

  modifiedSince(date?: Date) {
    if (date != null) this.where({ updatedAt: { [Op.gte]: date } });
    return this;
  }

  filterPlantStartRange(from?: Date, to?: Date) {
    if (from == null && to == null) return this;
    const parts: WhereOptions[] = [{ plantStart: { [Op.ne]: null } }];
    if (from != null) parts.push({ plantStart: { [Op.gte]: from } });
    if (to != null) parts.push({ plantStart: { [Op.lte]: to } });
    this.where({ [Op.and]: parts });
    return this;
  }

  filterPractice(practices?: string[]) {
    if (practices == null || practices.length === 0) return this;
    this.where(this.buildJsonArrayOverlapWhere("practice", practices));
    return this;
  }

  filterDistr(distributions?: string[]) {
    if (distributions == null || distributions.length === 0) return this;
    this.where(this.buildJsonArrayOverlapWhere("distr", distributions));
    return this;
  }

  filterSubmissionCycle(submissionCycles?: string[]) {
    if (submissionCycles == null || submissionCycles.length === 0) return this;
    this.where(this.buildJsonArrayOverlapWhere("submissionCycle", submissionCycles));
    return this;
  }

  filterTargetSys(values?: string[]) {
    if (values == null || values.length === 0) return this;
    this.where({
      [Op.and]: [{ targetSys: { [Op.ne]: null } }, { targetSys: { [Op.in]: values } }]
    });
    return this;
  }

  filterSource(values?: string[]) {
    if (values == null || values.length === 0) return this;
    this.where({
      [Op.and]: [{ source: { [Op.ne]: null } }, { source: { [Op.in]: values } }]
    });
    return this;
  }

  filterHasOverlap(hasOverlap?: boolean) {
    if (hasOverlap !== true) return this;

    const criteriaTable = CriteriaSite.tableName;
    this.where(
      literal(
        `EXISTS (SELECT 1 FROM ${criteriaTable} WHERE ${criteriaTable}.polygon_id = SitePolygon.poly_id AND ` +
          `${criteriaTable}.criteria_id = ${SitePolygon.sql.escape(VALIDATION_CRITERIA_IDS.OVERLAPPING)} AND ` +
          `${criteriaTable}.valid = 0)`
      )
    );
    return this;
  }

  private buildJsonArrayOverlapWhere(column: "practice" | "distr" | "submissionCycle", values: string[]): WhereOptions {
    const orContains = values.map(slug =>
      literal(`JSON_CONTAINS(SitePolygon.${column}, ${SitePolygon.sql.escape(JSON.stringify(slug))}, '$') = 1`)
    );
    return {
      [Op.and]: [
        { [column]: { [Op.ne]: null } } as WhereOptions,
        literal(`JSON_LENGTH(SitePolygon.${column}) > 0`),
        { [Op.or]: orContains }
      ]
    };
  }

  isMissingIndicators(indicatorSlugs?: IndicatorSlug[]) {
    if (indicatorSlugs != null) {
      const literals = uniq(indicatorSlugs).map(slug => {
        const model = INDICATOR_MODEL_CLASSES[slug];
        if (model == null) throw new BadRequestException(`Unrecognized indicator slug: ${slug}`);

        const tableName = model.tableName;
        return literal(
          `(SELECT COUNT(*) = 0 FROM ${tableName} WHERE indicator_slug = ${SitePolygon.sql.escape(
            slug
          )} AND site_polygon_id = SitePolygon.id)`
        );
      });
      this.where({ [Op.and]: literals });
    }
    return this;
  }

  hasPresentIndicators(indicatorSlugs?: IndicatorSlug[]) {
    if (indicatorSlugs != null) {
      const literals = uniq(indicatorSlugs).map(slug => {
        const model = INDICATOR_MODEL_CLASSES[slug];
        if (model == null) throw new BadRequestException(`Unrecognized indicator slug: ${slug}`);

        const tableName = model.tableName;
        return literal(
          `(SELECT COUNT(*) > 0 from ${tableName} WHERE indicator_slug = ${SitePolygon.sql.escape(
            slug
          )} AND site_polygon_id = SitePolygon.id)`
        );
      });
      this.where({ [Op.and]: literals });
    }
    return this;
  }
}
