import { Organisation, Project } from "@terramatch-microservices/database/entities";
import { AirtableEntity, ColumnMapping, mapEntityColumns, selectAttributes } from "./airtable-entity";

const COHORTS = {
  terrafund: "TerraFund Top 100",
  "terrafund-landscapes": "TerraFund Landscapes",
  ppc: "Priceless Planet Coalition (PPC)"
};

const UUID_COLUMN = "TM Project ID";

const COLUMNS: ColumnMapping<Project>[] = [
  ["uuid", UUID_COLUMN],
  ["name", "Project Name"],
  {
    airtableColumn: "TM Organization ID",
    valueMap: async project => (await project.loadOrganisation())?.uuid
  },
  {
    airtableColumn: "Organization Name Clean (lookup)",
    valueMap: async project => (await project.loadOrganisation())?.name
  },
  ["country", "Project Location Country Code"],
  {
    dbColumn: "frameworkKey",
    airtableColumn: "Cohort",
    valueMap: async ({ frameworkKey }) => COHORTS[frameworkKey]
  },
  ["objectives", "Project Objectives"],
  ["budget", "Project Budget"],
  ["totalHectaresRestoredGoal", "Number of Hectares to be Restored"],
  ["goalTreesRestoredPlanting", "Number of Trees to be Planted"],
  ["goalTreesRestoredAnr", "Total Trees Naturally Regenerated"],
  ["jobsCreatedGoal", "Jobs to be Created"],
  ["projBeneficiaries", "Project Beneficiaries Expected"],
  ["plantingStartDate", "Planting Dates - Start"],
  ["plantingEndDate", "Planting Dates - End"]
];

export const ProjectEntity: AirtableEntity<Project> = {
  TABLE_NAME: "Projects",
  UUID_COLUMN,

  findOne: async (uuid: string) =>
    await Project.findOne({
      where: { uuid },
      attributes: selectAttributes(COLUMNS),
      include: { model: Organisation, attributes: ["uuid", "name"] }
    }),

  mapDbEntity: async (project: Project) => mapEntityColumns(project, COLUMNS)
};
