import { Application, Organisation, Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { flatten, groupBy } from "lodash";
import { FRAMEWORK_NAMES } from "@terramatch-microservices/database/constants/framework";

const loadApprovedSites = async (projectIds: number[]) =>
  groupBy(
    await Site.findAll({
      where: { projectId: projectIds, status: Site.APPROVED_STATUSES },
      attributes: ["id", "uuid", "projectId"]
    }),
    "projectId"
  );

const loadSitePolygons = async (siteUuids: string[]) =>
  groupBy(
    await SitePolygon.findAll({
      where: { siteUuid: siteUuids, isActive: true },
      attributes: ["siteUuid", "calcArea"]
    }),
    "siteUuid"
  );

type ProjectAssociations = {
  sitePolygons: SitePolygon[];
};

const COLUMNS: ColumnMapping<Project, ProjectAssociations>[] = [
  ...commonEntityColumns<Project, ProjectAssociations>("project"),
  "name",
  {
    dbColumn: "frameworkKey",
    airtableColumn: "cohort",
    valueMap: async ({ frameworkKey }) => FRAMEWORK_NAMES[frameworkKey] ?? frameworkKey
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
    airtableColumn: "hectaresRestoredToDate",
    valueMap: async (_, { sitePolygons }) =>
      Math.round(sitePolygons.reduce((total, { calcArea }) => total + calcArea, 0))
  },
  {
    airtableColumn: "continent",
    dbColumn: "continent",
    valueMap: async ({ continent }) => continent?.replace("_", "-")
  },
  "survivalRate",
  "descriptionOfProjectTimeline",
  "landholderCommEngage",
  "states",
  "detailedInterventionTypes",
  "waterSource",
  "baselineBiodiversity",
  "projImpactFoodsec",
  "projImpactBiodiv",
  "pctEmployeesMarginalised",
  "pctBeneficiariesMarginalised",
  "proposedGovPartners",
  "yearFiveCrownCover",
  "directSeedingSurvivalRate"
];

export class ProjectEntity extends AirtableEntity<Project, ProjectAssociations> {
  readonly TABLE_NAME = "Projects";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Project;
  readonly SUPPORTS_UPDATED_SINCE = false;

  async loadAssociations(projects: Project[]) {
    const projectIds = projects.map(({ id }) => id);
    const approvedSites = await loadApprovedSites(projectIds);
    const allSiteUuids = flatten(Object.values(approvedSites).map(sites => sites.map(({ uuid }) => uuid)));
    const sitePolygons = await loadSitePolygons(allSiteUuids);

    return projectIds.reduce((associations, projectId) => {
      const sites = approvedSites[projectId] ?? [];

      return {
        ...associations,
        [projectId]: {
          sitePolygons: sites.reduce(
            (polygons, { uuid }) => [...polygons, ...(sitePolygons[uuid] ?? [])],
            [] as SitePolygon[]
          )
        }
      };
    }, {} as Record<number, ProjectAssociations>);
  }
}
