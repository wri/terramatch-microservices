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
  {
    airtableColumn: "treeSpeciesCount",
    include: [{ association: "treesPlanted", attributes: ["name"] }],
    valueMap: async ({ treesPlanted }) => treesPlanted?.length ?? 0
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
        .reduce((sum, { ftTotal, ptTotal }) => sum + (ftTotal ?? 0) + (ptTotal ?? 0), 0)
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
  {
    airtableColumn: "ftWomen",
    include: [{ model: ProjectReport, attributes: ["ftWomen"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { ftWomen }) => sum + ftWomen, 0)
  },
  {
    airtableColumn: "ftMen",
    include: [{ model: ProjectReport, attributes: ["ftMen"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { ftMen }) => sum + ftMen, 0)
  },
  {
    airtableColumn: "ftYouth",
    include: [{ model: ProjectReport, attributes: ["ftYouth"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { ftYouth }) => sum + ftYouth, 0)
  },
  {
    airtableColumn: "ftNonYouth",
    include: [{ model: ProjectReport, attributes: ["ftNonYouth"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { ftNonYouth }) => sum + ftNonYouth, 0)
  },
  {
    airtableColumn: "ptWomen",
    include: [{ model: ProjectReport, attributes: ["ptWomen"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { ptWomen }) => sum + ptWomen, 0)
  },
  {
    airtableColumn: "ptMen",
    include: [{ model: ProjectReport, attributes: ["ptMen"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { ptMen }) => sum + ptMen, 0)
  },
  {
    airtableColumn: "ptYouth",
    include: [{ model: ProjectReport, attributes: ["ptYouth"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { ptYouth }) => sum + ptYouth, 0)
  },
  {
    airtableColumn: "ptNonYouth",
    include: [{ model: ProjectReport, attributes: ["ptNonYouth"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { ptNonYouth }) => sum + ptNonYouth, 0)
  },
  {
    airtableColumn: "volunteerTotal",
    include: [{ model: ProjectReport, attributes: ["volunteerTotal"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { volunteerTotal }) => sum + volunteerTotal, 0)
  },
  {
    airtableColumn: "volunteerWomen",
    include: [{ model: ProjectReport, attributes: ["volunteerWomen"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { volunteerWomen }) => sum + volunteerWomen, 0)
  },
  {
    airtableColumn: "volunteerMen",
    include: [{ model: ProjectReport, attributes: ["volunteerMen"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { volunteerMen }) => sum + volunteerMen, 0)
  },
  {
    airtableColumn: "volunteerYouth",
    include: [{ model: ProjectReport, attributes: ["volunteerYouth"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { volunteerYouth }) => sum + volunteerYouth, 0)
  },
  {
    airtableColumn: "volunteerNonYouth",
    include: [{ model: ProjectReport, attributes: ["volunteerNonYouth"] }],
    valueMap: async ({ reports }) =>
      (reports ?? [])
        .filter(({ status }) => ProjectReport.APPROVED_STATUSES.includes(status))
        .reduce((sum, { volunteerNonYouth }) => sum + volunteerNonYouth, 0)
  },

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
