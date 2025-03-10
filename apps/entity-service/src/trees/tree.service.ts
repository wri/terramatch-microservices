import {
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  TreeSpecies,
  TreeSpeciesResearch
} from "@terramatch-microservices/database/entities";
import { Includeable, Op, WhereOptions } from "sequelize";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Dictionary, filter, flatten, flattenDeep, groupBy, omit, uniq } from "lodash";
import { PreviousPlantingCountDto } from "./dto/establishment-trees.dto";

export const ESTABLISHMENT_REPORTS = ["project-reports", "site-reports", "nursery-reports"] as const;
export type EstablishmentReport = (typeof ESTABLISHMENT_REPORTS)[number];

export const ESTABLISHMENT_ENTITIES = ["sites", "nurseries", ...ESTABLISHMENT_REPORTS] as const;
export type EstablishmentEntity = (typeof ESTABLISHMENT_ENTITIES)[number];

type TreeReportModelType = typeof ProjectReport | typeof SiteReport | typeof NurseryReport;
type TreeModelType = TreeReportModelType | typeof Project | typeof Site | typeof Nursery;

const isReport = (type: EstablishmentEntity): type is EstablishmentReport => type.endsWith("-reports");

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
    if (entity === "site-reports" || entity === "nursery-reports") {
      // For site and nursery reports, we fetch both the establishment species on the parent entity
      // and on the Project
      const parentModel = entity === "site-reports" ? Site : Nursery;
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

      if (entity === "site-reports") {
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

      const report = await (entity === "site-reports"
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
      if (entity === "site-reports") {
        treeNames["seeds"] = uniq(((parent as Site).seedsPlanted ?? []).map(({ name }) => name));
      }
      return treeNames;
    } else if (["sites", "nurseries", "project-reports"].includes(entity)) {
      // for these we simply pull the project's trees
      const whereOptions = {
        where: { uuid },
        attributes: ["frameworkKey"],
        include: [
          {
            model: Project,
            // This id isn't necessary for the data we want to fetch, but sequelize requires it for
            // the nested includes
            attributes: ["id"],
            include: treeAssociations(Project, ["name", "collection"])
          }
        ]
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
      if (entity === "project-reports" && entityModel.frameworkKey === "ppc") {
        // For PPC Project reports, we have to pretend the establishment species are "nursery-seedling" because
        // that's the collection used at the report level, but "tree-planted" is used at the establishment level.
        // The FE depends on the collection returned here to match what's being used in the tree species input
        // or view table.
        return {
          ...omit(uniqueTrees, ["tree-planted"]),
          ["nursery-seedling"]: uniqueTrees["tree-planted"]
        };
      }

      return uniqueTrees;
    } else {
      throw new BadRequestException(`Entity type not supported: [${entity}]`);
    }
  }

  async getPreviousPlanting(
    entity: EstablishmentEntity,
    uuid: string
  ): Promise<Dictionary<Dictionary<PreviousPlantingCountDto>>> {
    if (!isReport(entity)) return undefined;

    let model: TreeReportModelType;
    switch (entity) {
      case "project-reports":
        model = ProjectReport;
        break;

      case "site-reports":
        model = SiteReport;
        break;

      case "nursery-reports":
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
    if (entity === "site-reports") {
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

    const planting = Object.keys(trees).reduce(
      (dict, collection) => ({
        ...dict,
        [collection]: trees[collection].reduce(
          (counts, tree) => ({
            ...counts,
            [tree.name]: {
              taxonId: counts[tree.name]?.taxonId ?? tree.taxonId,
              amount: (counts[tree.name]?.amount ?? 0) + (tree.amount ?? 0)
            }
          }),
          {} as Dictionary<PreviousPlantingCountDto>
        )
      }),
      {} as Dictionary<Dictionary<PreviousPlantingCountDto>>
    );

    if (entity === "site-reports") {
      planting["seeds"] = flatten((records as SiteReport[]).map(({ seedsPlanted }) => seedsPlanted)).reduce(
        (counts, seeding) => ({
          ...counts,
          [seeding.name]: {
            taxonId: undefined,
            amount: (counts[seeding.name]?.amount ?? 0) + (seeding.amount ?? 0)
          }
        }),
        {} as Dictionary<PreviousPlantingCountDto>
      );
    }

    return planting;
  }
}
