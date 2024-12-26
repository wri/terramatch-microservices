import {
  Application,
  Nursery,
  Organisation,
  Project,
  ProjectReport,
  Site,
  SitePolygon,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { AirtableEntity, ColumnMapping, mapEntityColumns, selectAttributes, selectIncludes } from "./airtable-entity";
import { flattenDeep } from "lodash";
import { Op } from "sequelize";

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
        attributes: ["status"],
        include: [
          {
            model: SiteReport,
            attributes: ["status"],
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
  {
    airtableColumn: "jobsCreatedToDate",
    include: [
      {
        model: ProjectReport,
        attributes: ["status", "ftTotal", "ptTotal"]
      }
    ],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .map(({ ftTotal, ptTotal }) => (ftTotal ?? 0) + (ptTotal ?? 0))
        .reduce((sum, total) => sum + total, 0)
  },
  {
    airtableColumn: "hectaresRestoredToDate",
    include: [
      {
        model: Site,
        attributes: ["uuid"]
      }
    ],
    // A given project can end up with _a lot_ of site polygons, which blows up the
    // first SQL query into too many rows, so doing this one as its own query is more
    // efficient.
    valueMap: async ({ sites }) => {
      if (sites == null || sites.length === 0) return 0;
      const sitePolygons = await SitePolygon.findAll({
        where: { siteUuid: { [Op.in]: sites.map(({ uuid }) => uuid) }, isActive: true },
        attributes: ["calcArea"]
      });
      return Math.round(sitePolygons.reduce((total, { calcArea }) => total + calcArea, 0));
    }
  },
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
