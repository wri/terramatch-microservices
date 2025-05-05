import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Organisation } from "@terramatch-microservices/database/entities";
import { filter, flatten, uniq } from "lodash";

type OrganisationAssociations = {
  hqCountryName: string;
  countryNames: string[];
  stateNames: string[];
};

const COLUMNS: ColumnMapping<Organisation, OrganisationAssociations>[] = [
  ...commonEntityColumns<Organisation, OrganisationAssociations>("organisation"),
  "status",
  "type",
  "private",
  "isTest",
  "name",
  "phone",
  "hqStreet1",
  "hqStreet2",
  "hqCity",
  "hqState",
  "hqZipcode",
  "hqCountry",
  associatedValueColumn("hqCountryName", "hqCountry"),
  "leadershipTeamTxt",
  "foundingDate",
  "description",
  "countries",
  associatedValueColumn("countryNames", "countries"),
  "languages",
  "treeCareApproach",
  "relevantExperienceYears",
  "treesGrown3Year",
  "treesGrownTotal",
  "haRestored3Year",
  "haRestoredTotal",
  "finStartMonth",
  "finBudgetCurrentYear",
  "finBudget1Year",
  "finBudget2Year",
  "finBudget3Year",
  "webUrl",
  "facebookUrl",
  "instagramUrl",
  "linkedinUrl",
  "twitterUrl",
  "additionalFundingDetails",
  "communityExperience",
  "totalTreesGrown",
  "avgTreeSurvivalRate",
  "treeMaintenanceAftercareApproach",
  "restoredAreasDescription",
  "restorationTypesImplemented",
  "historicMonitoringGeojson",
  "monitoringEvaluationExperience",
  "fundingHistory",
  "engagementFarmers",
  "engagementWomen",
  "engagementYouth",
  "currency",
  "states",
  associatedValueColumn("stateNames", "states"),
  "district",
  "accountNumber1",
  "accountNumber2",
  "loanStatusAmount",
  "loanStatusTypes",
  "approachOfMarginalizedCommunities",
  "communityEngagementNumbersMarginalized",
  "landSystems",
  "fundUtilisation",
  "detailedInterventionTypes",
  "totalBoardMembers",
  "pctBoardWomen",
  "pctBoardMen",
  "pctBoardYouth",
  "pctBoardNonYouth",
  "engagementNonYouth",
  "treeRestorationPractices",
  "businessModel",
  "subtype",
  "organisationRevenueThisYear",
  "fieldStaffSkills",
  "fpcCompany",
  "numOfFarmersOnBoard",
  "benefactorsFpcCompany",
  "boardRemunerationFpcCompany",
  "boardEngagementFpcCompany",
  "biodiversityFocus",
  "globalPlanningFrameworks",
  "pastGovCollaboration",
  "engagementLandless",
  "socioeconomicImpact",
  "environmentalImpact",
  "growthStage",
  "additionalComments"
];

export class OrganisationEntity extends AirtableEntity<Organisation, OrganisationAssociations> {
  readonly TABLE_NAME = "Organisations";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Organisation;

  async loadAssociations(organisations: Organisation[]) {
    const countryNames = await this.gadmCountryNames();
    const stateCountries = filter(
      uniq(flatten(organisations.map(({ states }) => states?.map(state => state.split(".")[0]))))
    );
    const stateNames = await this.gadmStateNames(stateCountries);

    return organisations.reduce(
      (associations, { id, hqCountry, countries, states }) => ({
        ...associations,
        [id]: {
          hqCountryName: hqCountry == null ? null : countryNames[hqCountry],
          countryNames: filter(countries?.map(country => countryNames[country])),
          stateNames: filter(states?.map(state => stateNames[state]))
        }
      }),
      {} as Record<number, OrganisationAssociations>
    );
  }
}
