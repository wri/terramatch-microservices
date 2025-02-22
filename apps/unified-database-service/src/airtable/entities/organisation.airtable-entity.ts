import { AirtableEntity, ColumnMapping, commonEntityColumns } from "./airtable-entity";
import { Organisation } from "@terramatch-microservices/database/entities";

const COLUMNS: ColumnMapping<Organisation>[] = [
  ...commonEntityColumns<Organisation>("organisation"),
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
  "leadershipTeamTxt",
  "foundingDate",
  "description",
  "countries",
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
  "ftPermanentEmployees",
  "ptPermanentEmployees",
  "tempEmployees",
  "femaleEmployees",
  "maleEmployees",
  "youngEmployees",
  "over35Employees",
  "additionalFundingDetails",
  "communityExperience",
  "totalEngagedCommunityMembers3Yr",
  "percentEngagedWomen3Yr",
  "percentEngagedMen3Yr",
  "percentEngagedUnder353Yr",
  "percentEngagedOver353Yr",
  "percentEngagedSmallholder3Yr",
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
  "communityMembersEngaged3yr",
  "communityMembersEngaged3yrWomen",
  "communityMembersEngaged3yrMen",
  "communityMembersEngaged3yrYouth",
  "communityMembersEngaged3yrNonYouth",
  "communityMembersEngaged3yrSmallholder",
  "communityMembersEngaged3YrBackwardClass",
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
  "numOfMarginalisedEmployees",
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
  "totalEmployees",
  "additionalComments"
];

export class OrganisationEntity extends AirtableEntity<Organisation> {
  readonly TABLE_NAME = "Organisations";
  readonly COLUMNS = COLUMNS;
  readonly MODEL = Organisation;
}
