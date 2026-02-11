import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { Organisation } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const OrganisationConfiguration: LinkedFieldConfiguration<Organisation> = {
  label: "Organisation",
  fields: {
    "org-type": {
      property: "type",
      label: "Type",
      inputType: "select",
      multiChoice: false,
      optionListKey: "organisation-type"
    },
    "org-sub-type": {
      property: "subtype",
      label: "Subtype",
      inputType: "select",
      multiChoice: false,
      optionListKey: "business-type"
    },
    "org-name": { property: "name", label: "Name", inputType: "text" },
    "org-phone": { property: "phone", label: "Phone", inputType: "text" },
    "org-hq-st1": { property: "hqStreet1", label: "HQ street 1", inputType: "text" },
    "org-hq-st2": { property: "hqStreet2", label: "HQ street 2", inputType: "text" },
    "org-hq-city": { property: "hqCity", label: "HQ city", inputType: "text" },
    "org-hq-state": { property: "hqState", label: "HQ state", inputType: "text" },
    "org-hq-zip": { property: "hqZipcode", label: "HQ zipcode", inputType: "text" },
    "org-hq-country": {
      property: "hqCountry",
      label: "HQ country",
      inputType: "select",
      multiChoice: false,
      optionListKey: "gadm-level-0"
    },
    "org-countries": {
      property: "countries",
      label: "Countries",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-0"
    },
    "org-languages": {
      property: "languages",
      label: "Languages",
      inputType: "select",
      multiChoice: true,
      optionListKey: "languages"
    },
    "org-fdg-dte": { property: "foundingDate", label: "Founding date", inputType: "date" },
    "org-web-url": { property: "webUrl", label: "Web url", inputType: "text" },
    "org-fb-url": { property: "facebookUrl", label: "Facebook url", inputType: "text" },
    "org-inst-url": { property: "instagramUrl", label: "Instagram url", inputType: "text" },
    "org-lnkn-url": { property: "linkedinUrl", label: "Linkedin url", inputType: "text" },
    "org-twi-url": { property: "twitterUrl", label: "Twitter url", inputType: "text" },
    "org-description": { property: "description", label: "Description", inputType: "long-text" },
    "org-ldr-shp-team": { property: "leadershipTeamTxt", label: "Leadership Team Text", inputType: "long-text" },
    "org-business-model": { property: "businessModel", label: "Business Model", inputType: "long-text" },
    "org-rel-exp-years": {
      property: "relevantExperienceYears",
      label: "Relevant experience years",
      inputType: "number"
    },
    "org-ha-res-tot": { property: "haRestoredTotal", label: "Ha restored total", inputType: "number" },
    "org-ha-res-3yr": { property: "haRestored3Year", label: "Ha restored -3 year", inputType: "number" },
    "org-tre-gro-tot": { property: "treesGrownTotal", label: "Trees grown total", inputType: "number" },
    "org-tre-gro-3yr": { property: "treesGrown3Year", label: "Trees grown -3 year", inputType: "number" },
    "org-fin_start_month": {
      property: "finStartMonth",
      label: "Start of financial year (month)",
      inputType: "select",
      multiChoice: false,
      optionListKey: "months"
    },
    "org-eng-farmers": {
      property: "engagementFarmers",
      label: "Engagement farmers",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-farmers"
    },
    "org-eng-women": {
      property: "engagementWomen",
      label: "Engagement women",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-women"
    },
    "org-eng-youth": {
      property: "engagementYouth",
      label: "Engagement youth",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-youth"
    },
    "org-eng-non-youth": {
      property: "engagementNonYouth",
      label: "Engagement non-youth",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-non-youth"
    },
    "org-ha-rst-tot": { property: "haRestoredTotal", label: "Ha restored Total", inputType: "number" },
    "org-ha-rst-3year": { property: "haRestored3Year", label: "Ha restored -3 year", inputType: "number" },
    "org-community-experience": {
      property: "communityExperience",
      label: "Community engagement experience",
      inputType: "long-text"
    },
    "org-tot-eng-comty-mbrs-3yr": {
      property: "totalEngagedCommunityMembers3Yr",
      label: "Total # of community members engaged over the last 3 years",
      inputType: "number"
    },
    "org-total-employees": { property: "totalEmployees", label: "Total number of employees", inputType: "number" },
    "org-female-employees": { property: "femaleEmployees", label: "Number of female employees", inputType: "number" },
    "org-male-employees": { property: "maleEmployees", label: "Number of male employees", inputType: "number" },
    "org-young-employees": {
      property: "youngEmployees",
      label: "Number of employees between and including ages 18 and 35",
      inputType: "number"
    },
    "org-temp-employees": { property: "tempEmployees", label: "Number of temporary employees", inputType: "number" },
    "org-ft-perm-employees": {
      property: "ftPermanentEmployees",
      label: "Number of full-time permanent employees",
      inputType: "number"
    },
    "org-pt-perm-employees": {
      property: "ptPermanentEmployees",
      label: "Number of part-time permanent employees",
      inputType: "number"
    },
    "org-over-35-employees": {
      property: "over35Employees",
      label: "Number of employees older than 35 years of age",
      inputType: "number"
    },
    "org-additional-comments": {
      property: "additionalComments",
      label: "Additional Comments",
      inputType: "long-text"
    },
    "org-engagement-farmers": {
      property: "engagementFarmers",
      label: "Engagement: Farmers",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-farmers"
    },
    "org-engagement-women": {
      property: "engagementWomen",
      label: "Engagement: Women",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-women"
    },
    "org-engagement-youth": {
      property: "engagementYouth",
      label: "Engagement: Youth",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-youth"
    },
    "org-add-fund-details": {
      property: "additionalFundingDetails",
      label: "Additional funding details",
      inputType: "long-text"
    },
    "org-total-trees-grown": { property: "totalTreesGrown", label: "Total trees grown", inputType: "number" },
    "org-avg-tree-survival-rate": {
      property: "avgTreeSurvivalRate",
      label: "Average tree survival rate",
      inputType: "number"
    },
    "org-tree-maint-aftercare-aprch": {
      property: "treeMaintenanceAftercareApproach",
      label: "Tree maintenance and aftercare approach",
      inputType: "long-text"
    },
    "org-restored-areas-desc": {
      property: "restoredAreasDescription",
      label: "Restored areas description",
      inputType: "long-text"
    },
    "org-mon-eval-exp": {
      property: "monitoringEvaluationExperience",
      label: "Monitoring evaluation experience",
      inputType: "long-text"
    },
    "org-pct-engaged-women-3yr": {
      property: "percentEngagedWomen3Yr",
      label: "Percent women engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-pct-engaged-men-3yr": {
      property: "percentEngagedMen3Yr",
      label: "Percent men engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-pct-engaged-young-3yr": {
      property: "percentEngagedUnder353Yr",
      label: "Percent youth engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-pct-engaged-old-3yr": {
      property: "percentEngagedOver353Yr",
      label: "Percent non-youth engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-pct-engaged-smallholder-3yr": {
      property: "percentEngagedSmallholder3Yr",
      label: "Percent smallholder engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-restoration-types-implemented": {
      property: "restorationTypesImplemented",
      label: "Restoration Intervention Types Implemented",
      multiChoice: true,
      inputType: "select"
    },
    "org-historic-monitoring-geojson": {
      property: "historicMonitoringGeojson",
      label: "Historic monitoring shapefile upload",
      inputType: "mapInput"
    },
    "org-states": {
      property: "states",
      label: "States",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-1"
    },
    "org-district": { property: "district", label: "District", inputType: "text" },
    "org-acc-num-1": { property: "accountNumber1", label: "Account Number 1", inputType: "text" },
    "org-acc-num-2": { property: "accountNumber2", label: "Account Number 2", inputType: "text" },
    "org-loan-status-amount": { property: "loanStatusAmount", label: "Loan Status Amount", inputType: "number" },
    "org-loan-status-types": {
      property: "loanStatusTypes",
      label: "Loan Status Types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "loan-status"
    },
    "org-marg-com-appr": {
      property: "approachOfMarginalizedCommunities",
      label: "Approach of Marginalized Communities",
      inputType: "long-text"
    },
    "org-marg-com-eng-num": {
      property: "communityEngagementNumbersMarginalized",
      label: "Marginalized Community Engagement Numbers",
      inputType: "long-text"
    },
    "org-land-systems": {
      property: "landSystems",
      label: "Land Systems",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "land-use-systems"
    },
    "org-fund-utilisation": {
      property: "fundUtilisation",
      label: "Fund Utilisation",
      inputType: "select",
      multiChoice: true,
      optionListKey: "loan-status"
    },
    "org-tree-restoration-strategies": {
      property: "treeRestorationPractices",
      label: "Tree Restoration Practices",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-strategies"
    },
    "org-detailed-interventions": {
      property: "detailedInterventionTypes",
      label: "Detailed Intervention Types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "interventions"
    },
    "org-com-eng-3yr": {
      property: "communityMembersEngaged3yr",
      label: "Community Members Engaged (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-men": {
      property: "communityMembersEngaged3yrMen",
      label: "Community Members Engaged - Men (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-women": {
      property: "communityMembersEngaged3yrWomen",
      label: "Community Members Engaged - Women (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-youth": {
      property: "communityMembersEngaged3yrYouth",
      label: "Community Members Engaged - Youth (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-non-youth": {
      property: "communityMembersEngaged3yrNonYouth",
      label: "Community Members Engaged - Non-Youth (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-smallholder": {
      property: "communityMembersEngaged3yrSmallholder",
      label: "Community Members Engaged - Smallholder (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-backward-class": {
      property: "communityMembersEngaged3YrBackwardClass",
      label: "Community Members Engaged - Backward Class (3 years)",
      inputType: "number"
    },
    "org-field-staff-skills": { property: "fieldStaffSkills", label: "Field staff skills", inputType: "long-text" },
    "org-fpc-company": {
      property: "fpcCompany",
      label: "FPC company",
      inputType: "radio",
      multiChoice: false,
      optionListKey: "yes-no"
    },
    "org-num_of-marginalised-employees": {
      property: "numOfMarginalisedEmployees",
      label: "Number of employees from Marginalised statuses",
      inputType: "number"
    },
    "org-benefactors-fpc-company": {
      property: "benefactorsFpcCompany",
      label: "Supporters/benefactors: FPC company",
      inputType: "long-text"
    },
    "org-board-remuneration-fpc-company": {
      property: "boardRemunerationFpcCompany",
      label: "Board remuneration: FPC company",
      inputType: "select",
      multiChoice: false,
      optionListKey: "board-remuneration"
    },
    "org-board-engagement-fpc-company": {
      property: "boardEngagementFpcCompany",
      label: "Board engagement: FPC company",
      inputType: "select",
      multiChoice: false,
      optionListKey: "board-engagement"
    },
    "org-biodiversity-focus": {
      property: "biodiversityFocus",
      label: "Biodiversity focus",
      inputType: "select",
      multiChoice: true,
      optionListKey: "biodiversity"
    },
    "org-global-planning-frameworks": {
      property: "globalPlanningFrameworks",
      label: "Global planning frameworks",
      inputType: "select",
      multiChoice: true,
      optionListKey: "planning-frameworks"
    },
    "org-past-gov-collaboration": {
      property: "pastGovCollaboration",
      label: "Past Government Collaboration",
      inputType: "long-text"
    },
    "org-engagement-landless": {
      property: "engagementLandless",
      label: "Engagement: Landless",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-landless"
    },
    "org-environmental-impact": {
      property: "environmentalImpact",
      label: "Environmental Impact",
      inputType: "long-text"
    },
    "org-socioeconomic-impact": {
      property: "socioeconomicImpact",
      label: "Socioeconomic Impact",
      inputType: "long-text"
    },
    "org-growith-stage": {
      property: "growthStage",
      label: "Stage of Growth",
      inputType: "select",
      multiChoice: false,
      optionListKey: "growith-stage"
    },
    "org-consortium": {
      property: "consortium",
      label: "Organizations involved in consortium and description",
      inputType: "long-text"
    },
    "org-female-youth-leadership-example": {
      property: "femaleYouthLeadershipExample",
      label: "Female or youth contribution to project leadership or decision making example",
      inputType: "long-text"
    },
    "org-level-0-past-restoration": {
      property: "level0PastRestoration",
      label: "countries where organisation has previously restored land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-0"
    },
    "org-level-1-past-restoration": {
      property: "level1PastRestoration",
      label: "GADM level 1 administrative areas where organisation has previously restored land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-1"
    },
    "org-level-2-past-restoration": {
      property: "level2PastRestoration",
      label: "GADM level 2 administrative areas where organisation has previously restored land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-2"
    },
    "org-trees-naturally-regenerated-total": {
      property: "treesNaturallyRegeneratedTotal",
      label: "Total trees naturally regenerated by organisation since founding",
      inputType: "number"
    },
    "org-trees-naturally-regenerated-3year": {
      property: "treesNaturallyRegenerated3Year",
      label: "Total trees naturally regenerated by organisation in last 36 months",
      inputType: "number"
    },
    "org-external-technical-assistance": {
      property: "externalTechnicalAssistance",
      label: "Description of Non-Financial Technical Assistance Organisation has Received",
      inputType: "long-text"
    },
    "org-barriers-to-funding": {
      property: "barriersToFunding",
      label: "Barriers organisation faces to accessing funding, scaling operations, or delivering impact",
      inputType: "long-text"
    },
    "org-capacity-building-support-needed": {
      property: "capacityBuildingSupportNeeded",
      label: "Where Support Needed for Project Capacity-Building",
      inputType: "long-text"
    },
    "org-associations-cooperatives": {
      property: "associationsCooperatives",
      label: "Is the organization an association or cooperative?",
      inputType: "boolean"
    },
    "org-territories-of-operation": {
      property: "territoriesOfOperation",
      label: "Territories in which the organization operates",
      inputType: "select",
      multiChoice: true,
      optionListKey: "land-tenures-brazil"
    },
    "org-decisionmaking-structure-description": {
      property: "decisionMakingStructureDescription",
      label: "Organization’s decision-making structure",
      inputType: "long-text"
    },
    "org-decisionmaking-structure-individuals-involved": {
      property: "decisionMakingStructureIndividualsInvolved",
      label: "Individuals involved in decision-making structure",
      inputType: "long-text"
    },
    "org-average-worker-income": {
      property: "averageWorkerIncome",
      label: "Average income per worker over the past year",
      inputType: "number"
    },
    "org-anr-practices-past": {
      property: "anrPracticesPast",
      label: "ANR practices that the organization has used",
      inputType: "select",
      multiChoice: true,
      optionListKey: "anr-practices"
    },
    "org-anr-monitoring-approaches": {
      property: "anrMonitoringApproaches",
      label: "Approaches the organization has used to monitor ANR progress",
      inputType: "select",
      multiChoice: true,
      optionListKey: "anr-monitoring-approaches-collection"
    },
    "org-anr-monitoring-approaches-description": {
      property: "anrMonitoringApproachesDescription",
      label: "Description of the approaches used to monitor ANR progress",
      inputType: "text"
    },
    "org-anr-communication-funders": {
      property: "anrCommunicationFunders",
      label: "How the organization communicated ANR impact to funders",
      inputType: "text"
    },
    "org-bioeconomy-products": {
      property: "bioeconomyProducts",
      label: "Bioeconomy products cultivated by organization",
      inputType: "text"
    },
    "org-bioeconomy-traditional-knowledge": {
      property: "bioeconomyTraditionalKnowledge",
      label: "Traditional Knowledge within the bioeconomy production process",
      inputType: "long-text"
    },
    "org-bioeconomy-product-processing": {
      property: "bioeconomyProductProcessing",
      label: "How bioeconomy products are processed before selling",
      inputType: "long-text"
    },
    "org-bioeconomy-buyers": {
      property: "bioeconomyBuyers",
      label: "Buyers of the bioeconomy products",
      inputType: "text"
    }
  },
  fileCollections: {
    "org-fcol-cover": { collection: "cover", label: "Cover image", inputType: "file", multiChoice: false },
    "org-fcol-lgl-reg": {
      collection: "legal_registration",
      label: "Legal registration",
      inputType: "file",
      multiChoice: true
    },
    "org-fcol-logo": { collection: "logo", label: "Logo image", inputType: "file", multiChoice: false },
    "org-fcol-ref": { collection: "reference", label: "Reference documents", inputType: "file", multiChoice: true },
    "org-fcol-op-bgt-1year": {
      collection: "op_budget_1year",
      label: "Budget -1 year documents",
      inputType: "file",
      multiChoice: true
    },
    "org-fcol-op-bgt-2year": {
      collection: "op_budget_2year",
      label: "Budget -2 year documents",
      inputType: "file",
      multiChoice: true
    },
    "org-fcol-op-bgt-3year": {
      collection: "op_budget_3year",
      label: "Budget -3 year documents",
      inputType: "file",
      multiChoice: true
    },
    "org-fcol-op-this-year": {
      collection: "op_budget_this_year",
      label: "Organization Budget for this year",
      inputType: "file",
      multiChoice: true
    },
    "org-fcol-op-next-year": {
      collection: "op_budget_next_year",
      label: "Organization Budget for next year",
      inputType: "file",
      multiChoice: true
    },
    "org-fcol-hst-rest": {
      collection: "historic_restoration",
      label: "Historic restoration",
      inputType: "file",
      multiChoice: true
    },
    "org-fcol-additional": {
      collection: "additional",
      label: "Additional documents",
      inputType: "file",
      multiChoice: true
    },
    "org-fcol-bank-statments": {
      collection: "bank_statements",
      label: "Bank statements",
      inputType: "file",
      multiChoice: true
    },
    "org-fcol-prev-annual-rpts": {
      collection: "previous_annual_reports",
      label: "Previous annual reports",
      inputType: "file",
      multiChoice: true
    },
    "org-avg-tree-surv-rate-proof": {
      collection: "avg_tree_survival_rate_proof",
      label: "Average tree survival rate proof",
      inputType: "file",
      multiChoice: true
    },
    "org-equ-ownership": {
      collection: "equity_ownership",
      label: "Equity Ownership",
      inputType: "file",
      multiChoice: false
    },
    "org-loan-status": { collection: "loan_status", label: "Loan Status", inputType: "file", multiChoice: true },
    "org-past-rest-photos": {
      collection: "restoration_photos",
      label: "Past Restoration Photos",
      inputType: "file",
      multiChoice: true
    },
    "org-startup-recognition-cert": {
      collection: "startup_recognition_cert",
      label: "Certificate of Startup Recognition",
      inputType: "file",
      multiChoice: true
    },
    "org-consortium-proof": {
      collection: "consortium_proof",
      label: "Proof of registration for other consortium applicants",
      inputType: "file",
      multiChoice: true
    },
    "org-consortium-partnership-agreements": {
      collection: "consortium_partnership_agreements",
      label: "Signed partnership documents",
      inputType: "file",
      multiChoice: true
    },
    "org-organogram": {
      collection: "organogram",
      label: "Organisation structure/diagram",
      inputType: "file",
      multiChoice: true
    },
    "org-ownership-documents": {
      collection: "ownership_documents",
      label: "Ownership documentation upload",
      inputType: "file",
      multiChoice: true
    },
    "org-carbon-credits-proofs": {
      collection: "carbon_credits_proof",
      label: "Proof of carbon credit issuing in past",
      inputType: "file",
      multiChoice: true
    }
  },
  relations: {
    "org-funding-types": {
      label: "Funding Type",
      resource: "fundingTypes",
      inputType: "fundingType"
    },
    "org-tree-species": {
      label: "Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "historical-tree-species"
    },
    "org-tree-species-restored": {
      label: "Tree species restored in landscape",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "historical-tree-species"
    },
    "org-ownership-stake": {
      label: "Ownership Stake",
      resource: "ownershipStake",
      inputType: "ownershipStake"
    },
    "org-beneficiaries-all": {
      label: "Community Members",
      resource: "demographics",
      inputType: "allBeneficiaries",
      collection: "all"
    },
    "org-employees-full-time": {
      label: "Full Time Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "full-time"
    },
    "org-employees-full-time-clt": {
      label: "Full Time CLT Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "full-time-clt"
    },
    "org-leadership-team": {
      label: "Leadership Team",
      resource: "leaderships",
      inputType: "leaderships",
      collection: "leadership-team"
    },
    "org-core-team-leaders": {
      label: "Core Team Leaders",
      resource: "leaderships",
      inputType: "leaderships",
      collection: "core-team-leaders"
    },
    "org-employees-part-time": {
      label: "Part Time Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "part-time"
    },
    "org-employees-part-time-clt": {
      label: "Part Time CLT Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "part-time-clt"
    },
    "org-employees-temp": {
      label: "Temp Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "temp"
    },
    "org-associates": {
      label: "Associates",
      resource: "demographics",
      inputType: "associates",
      collection: "all"
    },
    "org-financial-indicators-financial-collection": {
      label: "Financial collection",
      resource: "financialIndicators",
      inputType: "financialIndicators"
    },
    "org-hectares-historical": {
      label: "Hectares Restored",
      resource: "restoration",
      inputType: "hectares-historical",
      collection: "all"
    },
    "org-trees-historical-regenerated": {
      label: "Trees Regenerated",
      resource: "restoration",
      inputType: "trees-historical",
      collection: "regenerated"
    },
    "org-trees-historical-grown": {
      label: "Trees Grown",
      resource: "restoration",
      inputType: "trees-historical",
      collection: "grown"
    }
  }
};
