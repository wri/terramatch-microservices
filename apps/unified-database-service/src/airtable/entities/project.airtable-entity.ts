import {
  Application,
  Framework,
  Organisation,
  Project,
  Site,
  SitePolygon
} from "@terramatch-microservices/database/entities";
import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { filter, flatten, groupBy, uniq } from "lodash";

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
  countryName?: string;
  stateNames: string[];
};

const COLUMNS: ColumnMapping<Project, ProjectAssociations>[] = [
  ...commonEntityColumns<Project, ProjectAssociations>("project"),
  "name",
  {
    airtableColumn: "framework",
    dbColumn: "frameworkKey",
    include: [{ model: Framework, attributes: ["name"] }],
    valueMap: async ({ framework, frameworkKey }) => framework?.name ?? frameworkKey
  },
  "cohort",
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
  associatedValueColumn("countryName", "country"),
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
  "longTermGrowth",
  "projectCountyDistrict",
  "goalTreesRestoredPlanting",
  "goalTreesRestoredAnr",
  "goalTreesRestoredDirectSeeding",
  {
    airtableColumn: "hectaresRestoredToDate",
    valueMap: async (_, { sitePolygons }) =>
      Math.round(sitePolygons.reduce((total, { calcArea }) => total + (calcArea ?? 0), 0))
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
  associatedValueColumn("stateNames", "states"),
  "detailedInterventionTypes",
  "waterSource",
  "baselineBiodiversity",
  "projImpactFoodsec",
  "projImpactBiodiv",
  "proposedGovPartners",
  "yearFiveCrownCover",
  "directSeedingSurvivalRate"
];

export class ProjectEntity extends AirtableEntity<Project, ProjectAssociations> {
  readonly TABLE_NAME = "Projects";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Project;
  readonly SUPPORTS_UPDATED_SINCE = false;
  readonly FILTER_FLAGS = ["isTest"];

  async loadAssociations(projects: Project[]) {
    const projectIds = projects.map(({ id }) => id);
    const approvedSites = await loadApprovedSites(projectIds);
    const allSiteUuids = flatten(Object.values(approvedSites).map(sites => sites.map(({ uuid }) => uuid)));
    const sitePolygons = await loadSitePolygons(allSiteUuids);
    const countryNames = await this.gadmLevel0Names();
    const stateCountries = filter(
      uniq(flatten(projects.map(({ states }) => states?.map(state => state.split(".")[0]))))
    ) as string[];
    const stateNames = await this.gadmLevel1Names(stateCountries);

    return projects.reduce(
      (associations, { id, country, states }) => ({
        ...associations,
        [id]: {
          sitePolygons: (approvedSites[id] ?? []).reduce(
            (polygons, { uuid }) => [...polygons, ...(sitePolygons[uuid] ?? [])],
            [] as SitePolygon[]
          ),
          countryName: country == null ? undefined : countryNames[country],
          stateNames: filter(states?.map(state => stateNames[state]))
        }
      }),
      {} as Record<number, ProjectAssociations>
    );
  }
}
