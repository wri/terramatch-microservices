import { Project, Site, SiteReport, TreeSpeciesResearch } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { Injectable, NotFoundException, NotImplementedException } from "@nestjs/common";
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
    if (entity === "site-reports") {
      // For site reports, we fetch both the establishment species on Site and on Project
      const report = await SiteReport.findOne({
        where: { uuid },
        attributes: [],
        include: [
          {
            model: Site,
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
      });
      if (report == null) throw new NotFoundException();

      const siteNames = report.site.treeSpecies.map(({ name }) => name);
      const projectNames = report.site.project.treeSpecies.map(({ name }) => name);
      return uniq(filter([...projectNames, ...siteNames]));
    } else {
      // TODO
      throw new NotImplementedException();
    }
  }
}
