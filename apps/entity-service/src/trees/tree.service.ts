import {
  Nursery,
  NurseryReport,
  Project,
  Site,
  SiteReport,
  TreeSpeciesResearch
} from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { filter, uniq } from "lodash";

export const ESTABLISHMENT_ENTITIES = [
  "sites",
  "nurseries",
  "project-reports",
  "site-reports",
  "nursery-reports"
] as const;
export type EstablishmentEntity = (typeof ESTABLISHMENT_ENTITIES)[number];

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

  async findEstablishmentTreeSpecies(entity: EstablishmentEntity, uuid: string): Promise<string[]> {
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
    } else if (['sites", "nurseries', "project-reports"].includes(entity)) {
    } else {
      throw new BadRequestException(`Entity type not supported: [${entity}]`);
    }
  }
}
