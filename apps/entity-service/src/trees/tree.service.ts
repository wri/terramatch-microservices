import {
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  TreeSpeciesResearch
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { BadRequestException, Injectable, NotFoundException, NotImplementedException } from "@nestjs/common";
import { filter, flatten, uniq } from "lodash";

export const ESTABLISHMENT_REPORTS = ["project-reports", "site-reports", "nursery-reports"] as const;
export type EstablishmentReport = (typeof ESTABLISHMENT_REPORTS)[number];

export const ESTABLISHMENT_ENTITIES = ["sites", "nurseries", ...ESTABLISHMENT_REPORTS] as const;
export type EstablishmentEntity = (typeof ESTABLISHMENT_ENTITIES)[number];

const isReport = (type: EstablishmentEntity): type is EstablishmentReport => type.endsWith("-reports");

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

  async getEstablishmentTrees(entity: EstablishmentEntity, uuid: string): Promise<string[]> {
    if (entity === "site-reports" || entity === "nursery-reports") {
      // For site and nursery reports, we fetch both the establishment species on the parent entity
      // and on the Project
      const whereOptions = {
        where: { uuid },
        attributes: [],
        include: [
          {
            model: entity === "site-reports" ? Site : Nursery,
            // This id isn't necessary for the data we want to fetch, but sequelize requires it for
            // the nested includes
            attributes: ["id"],
            include: [
              { association: "treeSpecies", attributes: ["name"] },
              {
                model: Project,
                // This id isn't necessary for the data we want to fetch, but sequelize requires it for
                // the nested includes
                attributes: ["id"],
                include: [{ association: "treeSpecies", attributes: ["name"] }]
              }
            ]
          }
        ]
      };

      const report = await (entity === "site-reports"
        ? SiteReport.findOne(whereOptions)
        : NurseryReport.findOne(whereOptions));
      if (report == null) throw new NotFoundException();

      const parent = report instanceof SiteReport ? report.site : report.nursery;
      const parentTrees = parent.treeSpecies.map(({ name }) => name);
      const projectTrees = parent.project.treeSpecies.map(({ name }) => name);
      return uniq(filter([...parentTrees, ...projectTrees]));
    } else if (["sites", "nurseries", "project-reports"].includes(entity)) {
      // for these we simply pull the project's trees
      const whereOptions = {
        where: { uuid },
        attributes: [],
        include: [
          {
            model: Project,
            // This id isn't necessary for the data we want to fetch, but sequelize requires it for
            // the nested includes
            attributes: ["id"],
            include: [{ association: "treeSpecies", attributes: ["name"] }]
          }
        ]
      };

      const entityModel = await (entity === "sites"
        ? Site.findOne(whereOptions)
        : entity === "nurseries"
        ? Nursery.findOne(whereOptions)
        : ProjectReport.findOne(whereOptions));
      if (entityModel == null) throw new NotFoundException();

      return filter(entityModel.project.treeSpecies.map(({ name }) => name));
    } else {
      throw new BadRequestException(`Entity type not supported: [${entity}]`);
    }
  }

  async getPreviousPlanting(entity: EstablishmentEntity, uuid: string): Promise<Record<string, number>> {
    if (!isReport(entity)) return undefined;

    const treeReportWhere = (parentAttribute: string, report: ProjectReport | SiteReport | NurseryReport) => ({
      attributes: [],
      where: {
        [parentAttribute]: report[parentAttribute],
        dueAt: { [Op.lt]: report.dueAt }
      },
      include: [
        {
          association: "treeSpecies",
          attributes: ["name", "amount"],
          where: { amount: { [Op.gt]: 0 } }
        }
      ]
    });

    let records: (SiteReport | ProjectReport | NurseryReport)[];
    switch (entity) {
      case "project-reports": {
        const report = await ProjectReport.findOne({
          where: { uuid },
          attributes: ["dueAt", "projectId"]
        });
        if (report == null) throw new NotFoundException();

        records = await ProjectReport.findAll(treeReportWhere("projectId", report));
        break;
      }

      case "site-reports": {
        const report = await SiteReport.findOne({
          where: { uuid },
          attributes: ["dueAt", "siteId"]
        });
        if (report == null) throw new NotFoundException();

        records = await SiteReport.findAll(treeReportWhere("siteId", report));
        break;
      }

      case "nursery-reports": {
        const report = await NurseryReport.findOne({
          where: { uuid },
          attributes: ["dueAt", "nurseryId"]
        });
        if (report == null) throw new NotFoundException();

        records = await NurseryReport.findAll(treeReportWhere("nurseryId", report));
        break;
      }

      default:
        throw new NotImplementedException();
    }

    const trees = flatten(records.map(({ treeSpecies }) => treeSpecies));
    return trees.reduce<Record<string, number>>((counts, tree) => {
      return {
        ...counts,
        [tree.name]: (counts[tree.name] ?? 0) + tree.amount
      };
    }, {});
  }
}
