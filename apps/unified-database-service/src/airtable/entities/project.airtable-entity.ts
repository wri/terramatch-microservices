import {
  Application,
  Demographic,
  Nursery,
  Organisation,
  Project,
  ProjectReport,
  Seeding,
  Site,
  SitePolygon,
  SiteReport,
  TreeSpecies,
  Workday
} from "@terramatch-microservices/database/entities";
import { AirtableEntity, associationReducer, ColumnMapping } from "./airtable-entity";
import { flatten } from "lodash";
import { FindOptions, literal, Op, WhereOptions } from "sequelize";

const COHORTS = {
  terrafund: "TerraFund Top 100",
  "terrafund-landscapes": "TerraFund Landscapes",
  ppc: "Priceless Planet Coalition (PPC)",
  enterprises: "TerraFund Enterprises",
  hbf: "Harit Bharat Fund",
  "epa-ghana-pilot": "EPA-Ghana Pilot"
};

const loadProjectTreesPlanted = async (projectIds: number[]) =>
  (
    await TreeSpecies.findAll({
      where: {
        speciesableId: projectIds,
        speciesableType: Project.LARAVEL_TYPE,
        collection: "tree-planted",
        hidden: false
      },
      attributes: ["speciesableId", "name"]
    })
  ).reduce(associationReducer<TreeSpecies>("speciesableId"), {});

const loadApprovedProjectReports = async (projectIds: number[]) =>
  (
    await ProjectReport.findAll({
      where: { projectId: projectIds, status: ProjectReport.APPROVED_STATUSES },
      attributes: [
        "id",
        "projectId",
        "status",
        "ftTotal",
        "ptTotal",
        "ftWomen",
        "ftMen",
        "ftYouth",
        "ftNonYouth",
        "ptWomen",
        "ptMen",
        "ptYouth",
        "ptNonYouth",
        "volunteerTotal",
        "volunteerWomen",
        "volunteerMen",
        "volunteerYouth",
        "volunteerNonYouth"
      ]
    })
  ).reduce(associationReducer<ProjectReport>("projectId"), {});

const loadApprovedSites = async (projectIds: number[]) =>
  (
    await Site.findAll({
      where: { projectId: projectIds, status: Site.APPROVED_STATUSES },
      attributes: ["id", "uuid", "projectId"]
    })
  ).reduce(associationReducer<Site>("projectId"), {});

const loadApprovedNurseries = async (projectIds: number[]) =>
  (
    await Nursery.findAll({
      where: { projectId: projectIds, status: Nursery.APPROVED_STATUSES },
      attributes: ["id"]
    })
  ).reduce(associationReducer<Nursery>("projectId"), {});

const loadApprovedSiteReports = async (siteIds: number[]) =>
  (
    await SiteReport.findAll({
      where: { siteId: siteIds, status: SiteReport.APPROVED_STATUSES },
      attributes: ["id", "siteId"]
    })
  ).reduce(associationReducer<SiteReport>("siteId"), {});

const loadTreesPlantedToDate = async (siteReportIds: number[]) =>
  (
    await TreeSpecies.findAll({
      where: {
        speciesableId: siteReportIds,
        speciesableType: SiteReport.LARAVEL_TYPE,
        collection: "tree-planted",
        hidden: false
      },
      attributes: ["speciesableId", "name", "amount"]
    })
  ).reduce(associationReducer<TreeSpecies>("speciesableId"), {});

const loadSeedsPlantedToDate = async (siteReportIds: number[]) =>
  (
    await Seeding.findAll({
      where: {
        seedableId: siteReportIds,
        seedableType: SiteReport.LARAVEL_TYPE,
        hidden: false
      },
      attributes: ["seedableId", "name", "amount"]
    })
  ).reduce(associationReducer<Seeding>("seedableId"), {});

const loadSitePolygons = async (siteUuids: string[]) =>
  (
    await SitePolygon.findAll({
      where: { siteUuid: siteUuids, isActive: true },
      attributes: ["siteUuid", "calcArea"]
    })
  ).reduce(associationReducer<SitePolygon, string>("siteUuid"), {});

type ProjectAssociations = {
  treesPlanted: TreeSpecies[];
  approvedProjectReports: ProjectReport[];
  approvedSites: Site[];
  approvedSiteReports: SiteReport[];
  approvedNurseries: Nursery[];
  treesPlantedToDate: TreeSpecies[];
  seedsPlantedToDate: Seeding[];
  sitePolygons: SitePolygon[];
};

const COLUMNS: ColumnMapping<Project, ProjectAssociations>[] = [
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
    valueMap: async (_, { treesPlanted }) => treesPlanted.map(({ name }) => name)?.join(", ")
  },
  {
    airtableColumn: "treeSpeciesCount",
    valueMap: async (_, { treesPlanted }) => treesPlanted.length
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
    valueMap: async (_, { treesPlantedToDate }) =>
      treesPlantedToDate.reduce((sum, { amount }) => sum + (amount ?? 0), 0)
  },
  {
    airtableColumn: "seedsPlantedToDate",
    valueMap: async (_, { seedsPlantedToDate }) =>
      seedsPlantedToDate.reduce((sum, { amount }) => sum + (amount ?? 0), 0)
  },
  {
    airtableColumn: "jobsCreatedToDate",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { ftTotal, ptTotal }) => sum + (ftTotal ?? 0) + (ptTotal ?? 0), 0)
  },
  {
    airtableColumn: "hectaresRestoredToDate",
    valueMap: async (_, { sitePolygons }) =>
      Math.round(sitePolygons.reduce((total, { calcArea }) => total + calcArea, 0))
  },
  {
    airtableColumn: "numberOfSites",
    valueMap: async (_, { approvedSites }) => approvedSites.length
  },
  {
    airtableColumn: "numberOfNurseries",
    valueMap: async (_, { approvedNurseries }) => approvedNurseries.length
  },
  {
    airtableColumn: "continent",
    dbColumn: "continent",
    valueMap: async ({ continent }) => continent?.replace("_", "-")
  },
  {
    airtableColumn: "ftWomen",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { ftWomen }) => sum + ftWomen, 0)
  },
  {
    airtableColumn: "ftMen",
    valueMap: async (_, { approvedProjectReports }) => approvedProjectReports.reduce((sum, { ftMen }) => sum + ftMen, 0)
  },
  {
    airtableColumn: "ftYouth",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { ftYouth }) => sum + ftYouth, 0)
  },
  {
    airtableColumn: "ftNonYouth",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { ftNonYouth }) => sum + ftNonYouth, 0)
  },
  {
    airtableColumn: "ptWomen",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { ptWomen }) => sum + ptWomen, 0)
  },
  {
    airtableColumn: "ptMen",
    valueMap: async (_, { approvedProjectReports }) => approvedProjectReports.reduce((sum, { ptMen }) => sum + ptMen, 0)
  },
  {
    airtableColumn: "ptYouth",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { ptYouth }) => sum + ptYouth, 0)
  },
  {
    airtableColumn: "ptNonYouth",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { ptNonYouth }) => sum + ptNonYouth, 0)
  },
  {
    airtableColumn: "volunteerTotal",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { volunteerTotal }) => sum + volunteerTotal, 0)
  },
  {
    airtableColumn: "volunteerWomen",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { volunteerWomen }) => sum + volunteerWomen, 0)
  },
  {
    airtableColumn: "volunteerMen",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { volunteerMen }) => sum + volunteerMen, 0)
  },
  {
    airtableColumn: "volunteerYouth",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { volunteerYouth }) => sum + volunteerYouth, 0)
  },
  {
    airtableColumn: "volunteerNonYouth",
    valueMap: async (_, { approvedProjectReports }) =>
      approvedProjectReports.reduce((sum, { volunteerNonYouth }) => sum + volunteerNonYouth, 0)
  },
  {
    airtableColumn: "workdaysCount",
    // Querying once per project is more efficient than getting all the demographics for a set of
    // projects at once, and trying to associate them back to the project id.
    valueMap: async (_, { approvedProjectReports, approvedSiteReports }) => {
      const siteReportWorkdays =
        approvedSiteReports.length == 0
          ? null
          : literal(`(
        SELECT id
        FROM v2_workdays
        WHERE workdayable_type = '${SiteReport.LARAVEL_TYPE.replace(/\\/g, "\\\\")}'
          AND workdayable_id IN (${approvedSiteReports.map(({ id }) => id).join(",")})
          AND hidden = false
      )`);

      const projectReportWorkdays =
        approvedProjectReports.length == 0
          ? null
          : literal(`(
        SELECT id
        FROM v2_workdays
          WHERE workdayable_type = '${ProjectReport.LARAVEL_TYPE.replace(/\\/g, "\\\\")}'
          AND workdayable_id IN (${approvedProjectReports.map(({ id }) => id).join(",")})
          AND hidden = false
      )`);

      const where = {
        demographicalType: Workday.LARAVEL_TYPE,
        // We use Gender as the canonical sum value for a set of demographics
        type: "gender"
      } as WhereOptions<Demographic>;
      if (siteReportWorkdays == null && projectReportWorkdays == null) {
        return 0;
      } else if (siteReportWorkdays == null || projectReportWorkdays == null) {
        where["demographicalId"] = { [Op.in]: siteReportWorkdays ?? projectReportWorkdays };
      } else {
        where["demographicalId"] = {
          [Op.or]: [{ [Op.in]: siteReportWorkdays }, { [Op.in]: projectReportWorkdays }]
        };
      }

      return (await Demographic.sum("amount", { where })) ?? 0;
    }
  },
  "survivalRate",
  "descriptionOfProjectTimeline",
  "landholderCommEngage"
];

export class ProjectEntity extends AirtableEntity<Project, ProjectAssociations> {
  readonly TABLE_NAME = "Projects";
  readonly COLUMNS = COLUMNS;

  findAll = (options: FindOptions<Project>) => Project.findAll(options);

  async loadAssociations(projects: Project[]) {
    const projectIds = projects.map(({ id }) => id);
    const treesPlanted = await loadProjectTreesPlanted(projectIds);
    const approvedProjectReports = await loadApprovedProjectReports(projectIds);
    const approvedSites = await loadApprovedSites(projectIds);
    const allSiteIds = flatten(Object.values(approvedSites).map(sites => sites.map(({ id }) => id)));
    const allSiteUuids = flatten(Object.values(approvedSites).map(sites => sites.map(({ uuid }) => uuid)));
    const approvedNurseries = await loadApprovedNurseries(projectIds);
    const approvedSiteReports = await loadApprovedSiteReports(allSiteIds);
    const allSiteReportIds = flatten(Object.values(approvedSiteReports).map(reports => reports.map(({ id }) => id)));
    const treesPlantedToDate = await loadTreesPlantedToDate(allSiteReportIds);
    const seedsPlantedToDate = await loadSeedsPlantedToDate(allSiteReportIds);
    const sitePolygons = await loadSitePolygons(allSiteUuids);

    return projectIds.reduce((associations, projectId) => {
      const sites = approvedSites[projectId] ?? [];
      const siteReports = sites.reduce(
        (reports, { id }) => [...reports, ...(approvedSiteReports[id] ?? [])],
        [] as SiteReport[]
      );

      return {
        ...associations,
        [projectId]: {
          treesPlanted: treesPlanted[projectId] ?? [],
          approvedProjectReports: approvedProjectReports[projectId] ?? [],
          approvedSites: sites,
          approvedSiteReports: siteReports,
          approvedNurseries: approvedNurseries[projectId] ?? [],
          treesPlantedToDate: siteReports.reduce(
            (trees, { id }) => [...trees, ...(treesPlantedToDate[id] ?? [])],
            [] as TreeSpecies[]
          ),
          seedsPlantedToDate: siteReports.reduce(
            (seedings, { id }) => [...seedings, ...(seedsPlantedToDate[id] ?? [])],
            [] as Seeding[]
          ),
          sitePolygons: sites.reduce(
            (polygons, { uuid }) => [...polygons, ...(sitePolygons[uuid] ?? [])],
            [] as SitePolygon[]
          )
        }
      };
    }, {} as Record<number, ProjectAssociations>);
  }
}
