import { AirtableEntity, associatedValueColumn, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Organisation } from "@terramatch-microservices/database/entities";
import { filter, flatten, uniq } from "lodash";

type OrganisationAssociations = {
  hqCountryName: string | null;
  countryNames: string[];
  stateNames: string[];
  level0PastRestorationNames: string[];
  level1PastRestorationNames: string[];
  level2PastRestorationNames: string[];
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
  "additionalComments",
  "consortium",
  "femaleYouthLeadershipExample",
  "level0PastRestoration",
  associatedValueColumn("level0PastRestorationNames", "level0PastRestoration"),
  "level1PastRestoration",
  associatedValueColumn("level1PastRestorationNames", "level1PastRestoration"),
  "level2PastRestoration",
  associatedValueColumn("level2PastRestorationNames", "level2PastRestoration"),
  "treesNaturallyRegeneratedTotal",
  "treesNaturallyRegenerated3Year",
  "externalTechnicalAssistance",
  "barriersToFunding",
  "capacityBuildingSupportNeeded"
];

export class OrganisationEntity extends AirtableEntity<Organisation, OrganisationAssociations> {
  readonly TABLE_NAME = "Organisations";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Organisation;

  async loadAssociations(organisations: Organisation[]) {
    const countryNames = await this.gadmLevel0Names();
    const stateCountries = filter(
      uniq(flatten(organisations.map(({ states }) => states?.map(state => state.split(".")[0]))))
    ) as string[];
    const stateNames = await this.gadmLevel1Names(stateCountries);
    const level1Parents = filter(
      uniq(
        flatten(
          organisations.map(({ level1PastRestoration }) => level1PastRestoration?.map(code => code.split(".")[0]))
        )
      )
    ) as string[];
    const leve1Names = await this.gadmLevel1Names(level1Parents);
    // for level 2, we can't trivially extract the parent code from the child codes, so we have to work with the assumption
    // that the data is clean and the level 2 codes are all a direct child of one of the selected level 1 codes.
    const level2Parents = filter(
      uniq(flatten(organisations.map(({ level1PastRestoration }) => level1PastRestoration)))
    ) as string[];
    const level2Names = await this.gadmLevel2Names(level2Parents);

    return organisations.reduce(
      (
        associations,
        { id, hqCountry, countries, states, level0PastRestoration, level1PastRestoration, level2PastRestoration }
      ) => ({
        ...associations,
        [id]: {
          hqCountryName: hqCountry == null ? null : countryNames[hqCountry],
          countryNames: filter(countries?.map(country => countryNames[country])),
          stateNames: filter(states?.map(state => stateNames[state])),
          level0PastRestorationNames: filter((level0PastRestoration ?? []).map(code => countryNames[code])),
          level1PastRestorationNames: filter((level1PastRestoration ?? []).map(code => leve1Names[code])),
          level2PastRestorationNames: filter((level2PastRestoration ?? []).map(code => level2Names[code]))
        }
      }),
      {} as Record<number, OrganisationAssociations>
    );
  }
}
