import { AirtableEntity, associatedValueColumn, ColumnMapping, PolymorphicUuidAssociation } from "./airtable-entity";
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

const LARAVEL_TYPE_MAPPING: Record<string, PolymorphicUuidAssociation<TreeSpeciesAssociations>> = {
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
  readonly HAS_HIDDEN_FLAG = true;

  protected async loadAssociations(treeSpecies: TreeSpecies[]) {
    return this.loadPolymorphicUuidAssociations(LARAVEL_TYPE_MAPPING, "speciesableType", "speciesableId", treeSpecies);
  }
}
