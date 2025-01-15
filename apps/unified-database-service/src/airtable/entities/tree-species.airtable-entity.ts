import { AirtableEntity, associatedValueColumn, ColumnMapping } from "./airtable-entity";
import {
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectPitch,
  ProjectReport,
  Site,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { groupBy, uniq } from "lodash";
import { ModelCtor } from "sequelize-typescript";
import { FindOptions, Op } from "sequelize";

const LARAVEL_TYPE_MAPPING: Record<string, { model: ModelCtor; association: keyof TreeSpeciesAssociations }> = {
  [Nursery.LARAVEL_TYPE]: {
    association: "nurseryUuid",
    model: Nursery
  },
  [NurseryReport.LARAVEL_TYPE]: {
    association: "nurseryReportUuid",
    model: NurseryReport
  },
  [Organisation.LARAVEL_TYPE]: {
    association: "organisationUuid",
    model: Organisation
  },
  [ProjectPitch.LARAVEL_TYPE]: {
    association: "projectPitchUuid",
    model: ProjectPitch
  },
  [Project.LARAVEL_TYPE]: {
    association: "projectUuid",
    model: Project
  },
  [ProjectReport.LARAVEL_TYPE]: {
    association: "projectReportUuid",
    model: ProjectReport
  },
  [Site.LARAVEL_TYPE]: {
    association: "siteUuid",
    model: Site
  },
  [SiteReport.LARAVEL_TYPE]: {
    association: "siteReportUuid",
    model: SiteReport
  }
};

type TreeSpeciesAssociations = {
  nurseryUuid?: string;
  nurseryReportUuid?: string;
  organisationUuid?: string;
  projectPitchUuid?: string;
  projectUuid?: string;
  projectReportUuid?: string;
  siteUuid?: string;
  siteReportUuid?: string;
};

const COLUMNS: ColumnMapping<TreeSpecies, TreeSpeciesAssociations>[] = [
  "uuid",
  "name",
  "taxonId",
  "amount",
  "collection",
  associatedValueColumn("nurseryUuid", ["speciesableId", "speciesableType"]),
  associatedValueColumn("nurseryReportUuid", ["speciesableId", "speciesableType"]),
  associatedValueColumn("organisationUuid", ["speciesableId", "speciesableType"]),
  associatedValueColumn("projectPitchUuid", ["speciesableId", "speciesableType"]),
  associatedValueColumn("projectUuid", ["speciesableId", "speciesableType"]),
  associatedValueColumn("projectReportUuid", ["speciesableId", "speciesableType"]),
  associatedValueColumn("siteUuid", ["speciesableId", "speciesableType"]),
  associatedValueColumn("siteReportUuid", ["speciesableId", "speciesableType"])
];

export class TreeSpeciesEntity extends AirtableEntity<TreeSpecies, TreeSpeciesAssociations> {
  readonly TABLE_NAME = "Tree Species";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = TreeSpecies;

  protected getUpdatePageFindOptions(page: number, updatedSince?: Date) {
    const findOptions = super.getUpdatePageFindOptions(page, updatedSince);
    return {
      ...findOptions,
      // exclude hidden records
      where: { ...findOptions.where, hidden: false }
    } as FindOptions<TreeSpecies>;
  }

  protected getDeletePageFindOptions(deletedSince: Date, page: number) {
    return {
      ...super.getDeletePageFindOptions(deletedSince, page),
      where: {
        [Op.or]: {
          deletedAt: { [Op.gte]: deletedSince },
          // Include records that have been hidden since the timestamp as well.
          [Op.and]: {
            updatedAt: { [Op.gte]: deletedSince },
            hidden: true
          }
        }
      }
    };
  }

  protected async loadAssociations(treeSpecies: TreeSpecies[]) {
    const bySpeciesableType = groupBy(treeSpecies, "speciesableType");
    const associations = {} as Record<number, TreeSpeciesAssociations>;

    // This loop takes the speciesable types that have been grouped from this set of trees, queries
    // the appropriate models to find their UUIDs, and then associates that UUID with the correct
    // member of the TreeSpeciesAssociations for that tree. Each tree will only have one of these
    // UUIDs set.
    for (const type of Object.keys(bySpeciesableType)) {
      if (LARAVEL_TYPE_MAPPING[type] == null) {
        this.logger.error(`Speciesable type not recognized, ignoring [${type}]`);
        continue;
      }

      const { model, association } = LARAVEL_TYPE_MAPPING[type];
      const trees = bySpeciesableType[type];
      const ids = uniq(trees.map(({ speciesableId }) => speciesableId));
      const models = await model.findAll({ where: { id: ids }, attributes: ["id", "uuid"] });
      for (const tree of trees) {
        const { uuid } = (models.find(({ id }) => id === tree.speciesableId) as unknown as { uuid: string }) ?? {};
        associations[tree.id] = { [association]: uuid };
      }
    }

    return associations;
  }
}
