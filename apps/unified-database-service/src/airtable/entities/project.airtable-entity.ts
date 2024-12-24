import {
  Application,
  Nursery,
  Organisation,
  Project,
  Site,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { AirtableEntity, ColumnMapping, mapEntityColumns, selectAttributes, selectIncludes } from "./airtable-entity";
import { flattenDeep } from "lodash";

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
    airtableColumn: "cohort",
    valueMap: async ({ frameworkKey }) => COHORTS[frameworkKey] ?? frameworkKey
  },
  {
    airtableColumn: "applicationUuid",
    include: [{ model: Application, attributes: ["uuid"] }],
    valueMap: async ({ application }) => application?.uuid
  },
  {
    airtableColumn: "organisationUuid",
    include: [{ model: Organisation, attributes: ["uuid"] }],
    valueMap: async ({ organisation }) => organisation?.uuid
  },
  {
    airtableColumn: "organisationName",
    include: [{ model: Organisation, attributes: ["name"] }],
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
    include: [{ association: "treesPlanted", attributes: ["name"] }],
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
  {
    airtableColumn: "treesPlantedToDate",
    include: [
      {
        model: Site,
        attributes: ["id", "status"],
        include: [
          {
            model: SiteReport,
            attributes: ["id", "status"],
            include: [{ association: "treesPlanted", attributes: ["amount", "hidden"] }]
          }
        ]
      }
    ],
    // We could potentially limit the number of rows in the query by filtering for these statuses
    // in a where clause, but the mergeable include system is complicated enough without it trying
    // to understand how to merge where clauses, so doing this filtering in memory is fine.
    valueMap: async ({ sites }) =>
      flattenDeep(
        (sites ?? [])
          .filter(({ status }) => Site.APPROVED_STATUSES.includes(status))
          .map(({ reports }) =>
            (reports ?? [])
              .filter(({ status }) => SiteReport.APPROVED_STATUSES.includes(status))
              .map(({ treesPlanted }) => treesPlanted?.map(({ amount }) => amount))
          )
      ).reduce((sum, amount) => sum + (amount ?? 0), 0)
  },

  // jobs created to date
  // hectares restored to date

  {
    airtableColumn: "numberOfSites",
    include: [{ model: Site, attributes: ["id"] }],
    valueMap: async ({ sites }) => (sites ?? []).length
  },
  {
    airtableColumn: "numberOfNurseries",
    include: [{ model: Nursery, attributes: ["id"] }],
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
