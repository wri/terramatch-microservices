import {
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Seeding,
  Site,
  SiteReport,
  TreeSpecies,
  TreeSpeciesResearch
} from "@terramatch-microservices/database/entities";
import { col, fn, Includeable, Op, WhereOptions } from "sequelize";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Dictionary, filter, flatten, flattenDeep, groupBy, omit, uniq } from "lodash";
import { EntityType, REPORT_TYPES, ReportType } from "@terramatch-microservices/database/constants/entities";
import { PlantingCountDto, PlantingCountMap } from "./dto/planting-count.dto";

export const ESTABLISHMENT_ENTITIES = ["sites", "nurseries", ...REPORT_TYPES] as const;
export type EstablishmentEntity = (typeof ESTABLISHMENT_ENTITIES)[number];

export const REPORT_COUNT_ENTITIES = ["projects", "projectReports", "sites", "nurseries"] as const;
export type ReportCountEntity = (typeof REPORT_COUNT_ENTITIES)[number];

export const isEstablishmentEntity = (entity: EntityType): entity is EstablishmentEntity =>
  ESTABLISHMENT_ENTITIES.includes(entity as EstablishmentEntity);
export const isReportCountEntity = (entity: EntityType): entity is ReportCountEntity =>
  REPORT_COUNT_ENTITIES.includes(entity as ReportCountEntity);

type TreeReportModelType = typeof ProjectReport | typeof SiteReport | typeof NurseryReport;
type TreeModelType = TreeReportModelType | typeof Project | typeof Site | typeof Nursery;

const isReport = (type: EstablishmentEntity): type is ReportType => type.endsWith("Reports");

const treeAssociations = (model: TreeModelType, attributes: string[], where?: WhereOptions) =>
  model.TREE_ASSOCIATIONS.map(association => ({
    required: false,
    association,
    attributes,
    where: { ...where, hidden: false }
  }));

const uniqueTreeNames = (trees: Dictionary<TreeSpecies[]>) =>
  Object.keys(trees).reduce(
    (dict, collection) => ({
      ...dict,
      [collection]: uniq(filter(trees[collection].map(({ name }) => name)))
    }),
    {} as Dictionary<string[]>
  );

const countPlants = (trees: TreeSpecies[] | Seeding[]) =>
  trees.reduce(
    (counts, { name, taxonId, amount }) => ({
      ...counts,
      [name]: {
        taxonId: counts[name]?.taxonId ?? taxonId,
        amount: (counts[name]?.amount ?? 0) + (amount ?? 0)
      }
    }),
    {} as Dictionary<PlantingCountDto>
  );

const countTreeCollection = (trees: Dictionary<TreeSpecies[]>) =>
  Object.keys(trees).reduce(
    (map, collection) => ({ ...map, [collection]: countPlants(trees[collection]) }),
    {} as PlantingCountMap
  );

@Injectable()
export class TreeService {
  async searchScientificNames(search: string) {
    return (
      await TreeSpeciesResearch.findAll({
        where: {
          [Op.or]: [
            // By checking these two, we're limiting the search term to only occurrences at the
            // beginning of a word in the scientific name, which tends to lead to better results.
            { scientificName: { [Op.like]: `${search}%` } },
            { scientificName: { [Op.like]: `% ${search}%` } }
          ]
        },
        attributes: ["taxonId", "scientificName"],
        limit: 10
      })
    ).map(({ taxonId, scientificName }) => ({ taxonId, scientificName }));
  }

  async getEstablishmentTrees(entity: EstablishmentEntity, uuid: string): Promise<Dictionary<string[]>> {
    if (entity === "siteReports" || entity === "nurseryReports") {
      // For site and nursery reports, we fetch both the establishment species on the parent entity
      // and on the Project
      const parentModel = entity === "siteReports" ? Site : Nursery;
      const include = {
        model: parentModel,
        // This id isn't necessary for the data we want to fetch, but sequelize requires it for
        // the nested includes
        attributes: ["id"],
        include: [
          ...treeAssociations(parentModel, ["name", "collection"]),
          {
            model: Project,
            // This id isn't necessary for the data we want to fetch, but sequelize requires it for
            // the nested includes
            attributes: ["id"],
            include: treeAssociations(Project, ["name", "collection"])
          }
        ]
      };

      if (entity === "siteReports") {
        include.include.push({
          required: false,
          association: "seedsPlanted",
          attributes: ["name"],
          where: { hidden: false }
        });
      }

      const whereOptions = {
        where: { uuid },
        attributes: [],
        include: [include]
      };

      const report = await (entity === "siteReports"
        ? SiteReport.findOne(whereOptions)
        : NurseryReport.findOne(whereOptions));
      if (report == null) throw new NotFoundException();

      const parent = report instanceof SiteReport ? report.site : report.nursery;
      const trees = groupBy(
        flattenDeep([
          parentModel.TREE_ASSOCIATIONS.map(association => parent[association] as TreeSpecies[]),
          Project.TREE_ASSOCIATIONS.map(association => parent.project[association] as TreeSpecies[])
        ]),
        "collection"
      );

      const treeNames = uniqueTreeNames(trees);
      if (entity === "siteReports") {
        treeNames["seeds"] = uniq(((parent as Site).seedsPlanted ?? []).map(({ name }) => name));
      }
      return treeNames;
    } else if (["sites", "nurseries", "projectReports"].includes(entity)) {
      const include = [
        {
          model: Project,
          // This id isn't necessary for the data we want to fetch, but sequelize requires it for
          // the nested includes
          attributes: ["id"],
          include: treeAssociations(Project, ["name", "collection"])
        }
      ] as Includeable[];

      if (entity === "sites") {
        include.push({
          required: false,
          association: "seedsPlanted",
          attributes: ["name"],
          where: { hidden: false }
        });
      }

      const whereOptions = {
        where: { uuid },
        attributes: ["frameworkKey"],
        include
      };

      const entityModel = await (entity === "sites"
        ? Site.findOne(whereOptions)
        : entity === "nurseries"
        ? Nursery.findOne(whereOptions)
        : ProjectReport.findOne(whereOptions));
      if (entityModel == null) throw new NotFoundException();

      const uniqueTrees = uniqueTreeNames(
        groupBy(flatten(Project.TREE_ASSOCIATIONS.map(association => entityModel.project[association])), "collection")
      );
      if (entity === "projectReports" && entityModel.frameworkKey === "ppc") {
        // For PPC Project reports, we have to pretend the establishment species are "nursery-seedling" because
        // that's the collection used at the report level, but "tree-planted" is used at the establishment level.
        // The FE depends on the collection returned here to match what's being used in the tree species input
        // or view table.
        return {
          ...omit(uniqueTrees, ["tree-planted"]),
          ["nursery-seedling"]: uniqueTrees["tree-planted"]
        };
      }

      if (entity === "sites") {
        uniqueTrees["seeds"] = uniq(((entityModel as Site).seedsPlanted ?? []).map(({ name }) => name));
      }

      return uniqueTrees;
    } else {
      throw new BadRequestException(`Entity type not supported: [${entity}]`);
    }
  }

  async getPreviousPlanting(entity: EstablishmentEntity, uuid: string): Promise<PlantingCountMap> {
    if (!isReport(entity)) return undefined;

    let model: TreeReportModelType;
    switch (entity) {
      case "projectReports":
        model = ProjectReport;
        break;

      case "siteReports":
        model = SiteReport;
        break;

      case "nurseryReports":
        model = NurseryReport;
        break;

      default:
        throw new BadRequestException();
    }

    // @ts-expect-error Can't narrow the union TreeReportModelType automatically
    const report: InstanceType<TreeReportModelType> = await model.findOne({
      where: { uuid },
      attributes: ["dueAt", model.PARENT_ID]
    });
    if (report == null) throw new NotFoundException();

    const modelIncludes: Includeable[] = treeAssociations(model, ["taxonId", "name", "collection", "amount"], {
      amount: { [Op.gt]: 0 }
    });
    if (entity === "siteReports") {
      modelIncludes.push({
        required: false,
        association: "seedsPlanted",
        attributes: ["name", "taxonId", "amount"],
        where: { hidden: false, amount: { [Op.gt]: 0 } }
      });
    }

    // @ts-expect-error Can't narrow the union TreeReportModelType automatically
    const records: InstanceType<TreeReportModelType>[] = await model.findAll({
      attributes: [],
      where: {
        [model.PARENT_ID]: report[model.PARENT_ID],
        dueAt: { [Op.lt]: report.dueAt }
      },
      include: modelIncludes
    });

    const trees = groupBy(
      flattenDeep(
        records.map(record => model.TREE_ASSOCIATIONS.map(association => record[association] as TreeSpecies[]))
      ),
      "collection"
    );

    const planting = countTreeCollection(trees);
    if (entity === "siteReports") {
      planting["seeds"] = countPlants(flatten((records as SiteReport[]).map(({ seedsPlanted }) => seedsPlanted)));
    }

    return planting;
  }

  async getAssociatedReportCounts(entity: ReportCountEntity, uuid: string): Promise<PlantingCountMap> {
    const { TS, reportIds } = await this.getAssociatedReportTreeSpecies(entity, uuid);
    if (TS == null) return {};

    const planting = countTreeCollection(
      groupBy(
        await TS.findAll({
          raw: true,
          attributes: ["uuid", "name", "taxonId", "collection", [fn("SUM", col("amount")), "amount"]],
          group: ["taxonId", "name", "collection"]
        }),
        "collection"
      )
    );

    if (entity !== "nurseries") {
      planting["seeds"] = countPlants(await Seeding.visible().siteReports(reportIds).findAll());
    }

    return planting;
  }

  private async getAssociatedReportTreeSpecies(entity: ReportCountEntity, uuid: string) {
    const TS = TreeSpecies.visible();
    if (entity === "projects") {
      const { id } = await Project.findOne({ where: { uuid }, attributes: ["id"] });
      const reportIds = SiteReport.approvedIdsSubquery(Site.approvedIdsSubquery(id));
      return { TS: TS.siteReports(reportIds), reportIds };
    } else if (entity === "sites") {
      const { id } = await Site.findOne({ where: { uuid }, attributes: ["id"] });
      const reportIds = SiteReport.approvedIdsSubquery([id]);
      return { TS: TS.siteReports(reportIds), reportIds };
    } else if (entity === "projectReports") {
      const { taskId } = await ProjectReport.findOne({ where: { uuid }, attributes: ["taskId"] });
      if (taskId == null) return {};

      const reportIds = SiteReport.approvedIdsForTaskSubquery(taskId);
      return { TS: TS.siteReports(reportIds), reportIds };
    } else if (entity === "nurseries") {
      const { id } = await Nursery.findOne({ where: { uuid }, attributes: ["id"] });
      const reportIds = NurseryReport.approvedIdsSubquery([id]);
      return { TS: TS.nurseryReports(reportIds), reportIds };
    } else {
      throw new BadRequestException(`Invalid entity type [${entity}]`);
    }
  }
}
