import { Application, Nursery, Organisation, Project, Site } from "@terramatch-microservices/database/entities";
import { AirtableEntity, ColumnMapping, mapEntityColumns, selectAttributes, selectIncludes } from "./airtable-entity";

const COHORTS = {
  terrafund: "TerraFund Top 100",
  "terrafund-landscapes": "TerraFund Landscapes",
  ppc: "Priceless Planet Coalition (PPC)"
};

const COLUMNS: ColumnMapping<Project>[] = [
  "uuid",
  "name",
  {
    dbColumn: "frameworkKey",
    airtableColumn: "Cohort",
    valueMap: async ({ frameworkKey }) => COHORTS[frameworkKey] ?? frameworkKey
  },
  {
    airtableColumn: "applicationUuid",
    association: { model: Application, attributes: ["uuid"] },
    valueMap: async ({ application }) => application?.uuid
  },
  {
    airtableColumn: "organisationUuid",
    association: { model: Organisation, attributes: ["uuid"] },
    valueMap: async ({ organisation }) => organisation?.uuid
  },
  {
    airtableColumn: "organisationName",
    association: { model: Organisation, attributes: ["name"] },
    valueMap: async ({ organisation }) => organisation?.name
  },
  "status",
  "country",
  "description",
  "plantingStartDate",
  "plantingEndDate",
  "budget",
  "objectives",
  "projPartnerInfo",
  "sitingStrategy",
  "sitingStrategyDescription",
  "history",
  {
    airtableColumn: "treeSpecies",
    association: { association: "treesPlanted", attributes: ["name"] },
    valueMap: async ({ treesPlanted }) => treesPlanted?.map(({ name }) => name)?.join(", ")
  },
  "treesGrownGoal",
  "totalHectaresRestoredGoal",
  "environmentalGoals",
  "seedlingsSource",
  "landUseTypes",
  "restorationStrategy",
  "socioeconomicGoals",
  "communityIncentives",
  "landTenureProjectArea",
  "jobsCreatedGoal",
  "projBeneficiaries",
  "longTermGrowth",
  "projectCountyDistrict",
  "goalTreesRestoredPlanting",
  "goalTreesRestoredAnr",
  "goalTreesRestoredDirectSeeding",

  // trees planted to date
  // jobs created to date
  // hectares restored to date

  {
    airtableColumn: "numberOfSites",
    association: { model: Site, attributes: ["id"] },
    valueMap: async ({ sites }) => (sites ?? []).length
  },
  {
    airtableColumn: "numberOfNurseries",
    association: { model: Nursery, attributes: ["id"] },
    valueMap: async ({ nurseries }) => (nurseries ?? []).length
  },
  "continent",

  // job breakdown by gender, age, full-time/part-time (each a separate number)
  // number of volunteers
  // volunteers breakdown by gender and age
  // total number of tree species being planted
  // workdays created (new calculation)
  // seeds planted

  "survivalRate",
  "descriptionOfProjectTimeline",
  "landholderCommEngage"
];

export const ProjectEntity: AirtableEntity<Project> = {
  TABLE_NAME: "Projects",
  UUID_COLUMN: "uuid",

  findOne: async (uuid: string) =>
    await Project.findOne({
      where: { uuid },
      attributes: selectAttributes(COLUMNS),
      include: selectIncludes(COLUMNS)
    }),

  mapDbEntity: async (project: Project) => await mapEntityColumns(project, COLUMNS)
};
