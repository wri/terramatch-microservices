import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { ProjectPitch } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const ProjectPitchConfiguration: LinkedFieldConfiguration<ProjectPitch> = {
  label: "Project Pitch",
  fields: {
    "pro-pit-name": { property: "projectName", label: "Name", inputType: "text" },
    "pro-pit-objectives": { property: "projectObjectives", label: "Objectives", inputType: "long-text" },
    "pro-pit-district": { property: "projectCountyDistrict", label: "County district", inputType: "text" },
    "pro-pit-country": {
      property: "projectCountry",
      label: "Country",
      inputType: "select",
      multiChoice: false,
      optionListKey: "gadm-level-0"
    },
    "pro-pit-rst-inv-types": {
      property: "restorationInterventionTypes",
      label: "Restoration intervention types",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-systems"
    },
    "pro-pit-detailed-rst-inv-types": {
      property: "detailedInterventionTypes",
      label: "Detailed intervention types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "interventions"
    },
    "pro-pit-tot-ha": { property: "totalHectares", label: "Total hectares", inputType: "number" },
    "pro-pit-tot-trees": { property: "totalTrees", label: "Total trees", inputType: "number" },
    "pro-pit-bgt": { property: "projectBudget", label: "Project budget", inputType: "number" },
    "pro-pit-cap-bld-needs": {
      property: "capacityBuildingNeeds",
      label: "Capacity building needs",
      inputType: "select",
      multiChoice: true,
      optionListKey: "building-needs"
    },
    "pro-pit-how-discovered": {
      property: "howDiscovered",
      label: "How discovered WRI",
      inputType: "select",
      multiChoice: true,
      optionListKey: "media-channels"
    },
    "pro-pit-land-tenure-proj-area": {
      property: "landTenureProjArea",
      label: "Land tenure project area",
      inputType: "select",
      multiChoice: true,
      optionListKey: "land-tenure-proj-area-collection"
    },
    "pro-pit-expected-active-rest-start-date": {
      property: "expectedActiveRestorationStartDate",
      label: "Expected active restoration start date",
      inputType: "date"
    },
    "pro-pit-expected-active-rest-end-date": {
      property: "expectedActiveRestorationEndDate",
      label: "Expected active restoration end date",
      inputType: "date"
    },
    "pro-pit-desc-of-proj-timeline": {
      property: "descriptionOfProjectTimeline",
      label: "Description of project timeline",
      inputType: "long-text"
    },
    "pro-pit-proj-partner-info": {
      property: "projPartnerInfo",
      label: "Project partner info",
      inputType: "long-text"
    },
    "pro-pit-landholder-comm-engage": {
      property: "landholderCommEngage",
      label: "Landholder & Community Engagement Strategy",
      inputType: "long-text"
    },
    "pro-pit-proj-success-risks": {
      property: "projSuccessRisks",
      label: "Project risks to success",
      inputType: "long-text"
    },
    "pro-pit-monitor-eval-plan": {
      property: "monitorEvalPlan",
      label: "Monitoring and evaluation plan",
      inputType: "long-text"
    },
    "pro-pit-proj-boundary": { property: "projBoundary", label: "Project Boundary", inputType: "mapInput" },
    "pro-pit-sustainable-dev-goals": {
      property: "sustainableDevGoals",
      label: "Sustainable Development Goals",
      inputType: "select-image",
      multiChoice: true
    },
    "pro-pit-proj-area-desc": {
      property: "projAreaDescription",
      label: "Description of Project Area",
      inputType: "long-text"
    },
    "pro-pit-curr-land-degradation": {
      property: "currLandDegradation",
      label: "Main causes of degradation",
      inputType: "long-text"
    },
    "pro-pit-proposed-num-sites": {
      property: "proposedNumSites",
      label: "Proposed Number of Sites",
      inputType: "number"
    },
    "pro-pit-environmental-goals": {
      property: "environmentalGoals",
      label: "Environmental goals",
      inputType: "long-text"
    },
    "pro-pit-proposed-num-nurseries": {
      property: "proposedNumNurseries",
      label: "Proposed Number of Nurseries",
      inputType: "number"
    },
    "pro-pit-proj-impact-socieconom": {
      property: "projImpactSocieconom",
      label: "Potential project impact: socioeconomic",
      inputType: "long-text"
    },
    "pro-pit-proj-impact-foodsec": {
      property: "projImpactFoodsec",
      label: "Potential project impact: food security",
      inputType: "long-text"
    },
    "pro-pit-proj-impact-watersec": {
      property: "projImpactWatersec",
      label: "Potential project impact: water security",
      inputType: "long-text"
    },
    "pro-pit-proj-impact-jobtypes": {
      property: "projImpactJobtypes",
      label: "Potential project impact: types of jobs created",
      inputType: "long-text"
    },
    "pro-pit-num-jobs-created": { property: "numJobsCreated", label: "Number of jobs created", inputType: "number" },
    "pro-pit-beneficiaries": {
      property: "projBeneficiaries",
      label: "Total Expected project beneficiaries",
      inputType: "number"
    },
    "pro-pit-pct-beneficiaries-small": {
      property: "pctBeneficiariesSmall",
      label: "% Beneficiaries smallholder",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-large": {
      property: "pctBeneficiariesLarge",
      label: "% Beneficiaries large",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-women": {
      property: "pctBeneficiariesWomen",
      label: "% Beneficiaries women",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-men": {
      property: "pctBeneficiariesMen",
      label: "% Beneficiaries men",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-35below": {
      property: "pctBeneficiariesYouth",
      label: "% Beneficiaries youth",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-sch-classes": {
      property: "pctBeneficiariesScheduledClasses",
      label: "% Beneficiaries Scheduled Classes",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-sch-tribes": {
      property: "pctBeneficiariesScheduledTribes",
      label: "% Beneficiaries Scheduled Tribes",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-marginalised": {
      property: "pctBeneficiariesMarginalised",
      label: "% Beneficiaries Marginalised Communities",
      inputType: "number-percentage"
    },
    "pro-pit-main-degradation_causes": {
      property: "mainDegradationCauses",
      label: "Main degradation causes",
      inputType: "long-text"
    },
    "pro-pit-seedlings-source": { property: "seedlingsSource", label: "Seedlings source", inputType: "long-text" },
    "pro-pit-pct-employees-men": {
      property: "pctEmployeesMen",
      label: "% of total employees that would be men",
      inputType: "number-percentage"
    },
    "pro-pit-pct-employees-women": {
      property: "pctBeneficiariesWomen",
      label: "% of total employees that would be women",
      inputType: "number-percentage"
    },
    "pro-pit-pct-employees-18to35": {
      property: "pctEmployees18To35",
      label: "% of total employees that would be between the ages of 18 and 35",
      inputType: "number-percentage"
    },
    "pro-pit-pct-employees-older35": {
      property: "pctEmployeesOlder35",
      label: "% of total employees that would be older than 35 years of age",
      inputType: "number-percentage"
    },
    "pro-pit-pct-employees-marginalised": {
      property: "pctEmployeesMarginalised",
      label: "% of total employees that would be part of a marginalised community",
      inputType: "number-percentage"
    },
    "pro-pit-states": {
      property: "states",
      label: "States",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-1"
    },
    "pro-pit-hec-yr1": {
      property: "hectaresFirstYr",
      label: "Hectares to be restored in the first year",
      inputType: "number"
    },
    "pro-pit-trees-yr1": {
      property: "totalTreesFirstYr",
      label: "Trees planted in the first year",
      inputType: "number"
    },
    "pro-pit-pct-beneficiaries-backward-class": {
      property: "pctBeneficiariesBackwardClass",
      label: "% Beneficiaries backward class",
      inputType: "number-percentage"
    },
    "pro-pit-land-systems": {
      property: "landSystems",
      label: "Land systems",
      inputType: "select",
      multiChoice: true,
      optionListKey: "restoration-systems"
    },
    "pro-pit-tree-rest-prac": {
      property: "treeRestorationPractices",
      label: "Tree Restoration Practices",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-practices"
    },
    "pro-pit-main-cause-deg": {
      property: "mainCausesOfDegradation",
      label: "Main causes of degradation",
      inputType: "long-text"
    },
    "pro-theory-of-change": { property: "theoryOfChange", label: "Theory of change", inputType: "long-text" },
    "pro-proposed-gov-partners": {
      property: "proposedGovPartners",
      label: "Proposed government partners",
      inputType: "long-text"
    },
    "pro-pct-sch-tribe": {
      property: "pctSchTribe",
      label: "% of total employees that would be Scheduled Caste/Other Backward Class/Scheduled Tribe",
      inputType: "number-percentage"
    },
    "pro-sustainability-plan": {
      property: "sustainabilityPlan",
      label: "Project sustainability plan",
      inputType: "long-text"
    },
    "pro-replication-plan": { property: "replicationPlan", label: "Project replication plan", inputType: "long-text" },
    "pro-replication-challenges": {
      property: "replicationChallenges",
      label: "Project replication challenges",
      inputType: "long-text"
    },
    "pro-solution-market-size": {
      property: "solutionMarketSize",
      label: "Solution market size",
      inputType: "long-text"
    },
    "pro-affordability-of-solution": {
      property: "affordabilityOfSolution",
      label: "Affordability of solution/products",
      inputType: "long-text"
    },
    "pro-growth-trends-business": {
      property: "growthTrendsBusiness",
      label: "Growth trends of business",
      inputType: "long-text"
    },
    "pro-limitations-on-scope": {
      property: "limitationsOnScope",
      label: "Limitations on scope of operations",
      inputType: "long-text"
    },
    "pro-business-model-replication_plan": {
      property: "businessModelReplicationPlan",
      label: "Business model replication plan",
      inputType: "long-text"
    },
    "pro-biodiversity-impact": {
      property: "biodiversityImpact",
      label: "Biodiversity Impact (project)",
      inputType: "long-text"
    },
    "pro-water-source": { property: "waterSource", label: "Water Source (project)", inputType: "long-text" },
    "pro-climate-resilience": {
      property: "climateResilience",
      label: "Climate resilience (project)",
      inputType: "long-text"
    },
    "pro-soil-health": { property: "soilHealth", label: "Soil Health (project)", inputType: "long-text" },
    "pro-pit-land-use-types": {
      property: "landUseTypes",
      label: "Land use types",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-systems"
    },
    "pro-pit-restoration_strategy": {
      property: "restorationStrategy",
      label: "Restoration strategy",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-practices"
    },
    "pro-pit-baseline-biodiversity": {
      property: "baselineBiodiversity",
      label: "Baseline Biodiversity Conditions",
      inputType: "long-text"
    },
    "pro-pit-goal-trees-restored-planting": {
      property: "goalTreesRestoredPlanting",
      label: "Trees Restored Goal - Planting",
      inputType: "number"
    },
    "pro-pit-goal-trees-restored-anr": {
      property: "goalTreesRestoredAnr",
      label: "Trees Restored Goal - ANR",
      inputType: "number"
    },
    "pro-pit-goal-trees-restored-direct-seeding": {
      property: "goalTreesRestoredDirectSeeding",
      label: "Trees Restored Goal - Direct Seeding",
      inputType: "number"
    },
    "pro-pit-direct-seeding-survival-rate": {
      property: "directSeedingSurvivalRate",
      label: "Direct Seeding Survival Rate",
      inputType: "number-percentage"
    },
    "pro-pit-level-0-proposed": {
      property: "level0Proposed",
      label: "countries where project will be restoring land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-0"
    },
    "pro-pit-level-1-proposed": {
      property: "level1Proposed",
      label: "GADM level 1 administrative areas where project will be restoring land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-1"
    },
    "pro-pit-level-2-proposed": {
      property: "level2Proposed",
      label: "GADM level 2 administrative areas where project will be restoring land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-2"
    },
    "pro-pit-lat-proposed": {
      property: "latProposed",
      label: "Proposed center point of a restoration site - latitude",
      inputType: "number"
    },
    "pro-pit-long-proposed": {
      property: "lngProposed",
      label: "Proposed center point of a restoration site - longitude",
      inputType: "number"
    },
    "pro-pit-stakeholder-engagement": {
      property: "stakeholderEngagement",
      label: "Local stakeholders affected by project",
      inputType: "long-text"
    },
    "pro-pit-landowner-agreement": {
      property: "landownerAgreement",
      label: "Prior agreement with landowner to use their land for restoration",
      inputType: "select",
      multiChoice: false,
      optionListKey: "landowner-collection"
    },
    "pro-pit-landowner-agreement-description": {
      property: "landownerAgreementDescription",
      label: "Explanation of landowner agreement",
      inputType: "long-text"
    },
    "pro-pit-land-tenure-risks": {
      property: "landTenureRisks",
      label: "Risks or challenges in securing tenure arrangements with landowners",
      inputType: "long-text"
    },
    "pro-pit-non-tree-interventions-description": {
      property: "nonTreeInterventionsDescription",
      label: "Additional non-tree intervention description",
      inputType: "long-text"
    },
    "pro-pit-complement-existing-restoration": {
      property: "complementExistingRestoration",
      label: "Project complements existing restoration",
      inputType: "long-text"
    },
    "pro-pit-restoration-strategy-distribution": {
      property: "restorationStrategyDistribution",
      label: "Distribution of restoration strategies",
      inputType: "strategy-area",
      multiChoice: false,
      optionListKey: "strategy-distribution-collection"
    },
    "pro-pit-land-use-type-distribution": {
      property: "landUseTypeDistribution",
      label: "Distribution of land use systems",
      inputType: "strategy-area",
      multiChoice: false,
      optionListKey: "land-use-distribution-collection"
    },
    "pro-pit-land-tenure-distribution": {
      property: "landTenureDistribution",
      label: "Distribution of land tenure agreement",
      inputType: "strategy-area",
      multiChoice: false,
      optionListKey: "tenure-distribution-collection"
    },
    "pro-pit-total-tree-second-yr": {
      property: "totalTreeSecondYr",
      label: "Trees Planted in Second Year",
      inputType: "number"
    },
    "pro-pit-proj-survival-rate": {
      property: "projSurvivalRate",
      label: "Projected Project Survival Rate",
      inputType: "number-percentage"
    },
    "pro-pit-anr-approach": { property: "anrApproach", label: "Project Approach to ANR", inputType: "text" },
    "pro-pit-anr-rights": { property: "anrRights", label: "How to Secure Rights to Conduct ANR", inputType: "text" },
    "pro-pit-project-site-model": {
      property: "projectSiteModel",
      label: "Project site distribution model",
      inputType: "select",
      multiChoice: false,
      optionListKey: "project-site-model-collection"
    },
    "pro-pit-indigenous-impact": {
      property: "indigenousImpact",
      label: "Project Impacts or Benefits for Indigenous People",
      inputType: "text"
    },
    "pro-pit-barriers-project-activity": {
      property: "barriersProjectActivity",
      label: "Barriers to Project Activities",
      inputType: "select",
      multiChoice: true,
      optionListKey: "barriers-project-collection"
    },
    "pro-pit-barriers-project-activity-description": {
      property: "barriersProjectActivityDescription",
      label: "Barriers to Project Activities Descriptions",
      inputType: "text"
    },
    "pro-pit-other-engage-women-youth": {
      property: "otherEngageWomenYouth",
      label: "Other Ways Project will Engage and Benefit Women/Youth",
      inputType: "text"
    },
    "pro-pit-forest-fragments-distance": {
      property: "forestFragmentsDistance",
      label: "Approximate distance in meters between project area and the center of the nearest forest fragment",
      inputType: "number"
    },
    "pro-pit-anr-practices-proposed": {
      property: "anrPracticesProposed",
      label: "ANR practices that the organization will use during the project",
      inputType: "select",
      multiChoice: true,
      optionListKey: "anr-practices-proposed-collection"
    },
    "pro-pit-information-authorization": {
      property: "informationAuthorization",
      label: "If the organization authorizes WRI to use their data for research",
      inputType: "boolean"
    },
    "pro-pit-full-time-jobs-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "jobs",
        collection: "full-time"
      },
      label: "Aggregate full time jobs",
      inputType: "number"
    },
    "pro-pit-full-time-clt-jobs-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "jobs",
        collection: "full-time-clt"
      },
      label: "Aggregate full time CLT jobs",
      inputType: "number"
    },
    "pro-pit-part-time-jobs-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "jobs",
        collection: "part-time"
      },
      label: "Aggregate part time jobs",
      inputType: "number"
    },
    "pro-pit-part-time-clt-jobs-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "jobs",
        collection: "part-time-clt"
      },
      label: "Aggregate part time CLT jobs",
      inputType: "number"
    },
    "pro-pit-volunteers-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "volunteers",
        collection: "volunteer"
      },
      label: "Aggregate volunteers",
      inputType: "number"
    },
    "pro-pit-beneficiaries-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "all-beneficiaries",
        collection: "all"
      },
      label: "Aggregate beneficiaries",
      inputType: "number"
    },
    "pro-pit-indirect-beneficiaries-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "indirect-beneficiaries",
        collection: "indirect"
      },
      label: "Aggregate indirect beneficiaries",
      inputType: "number"
    },
    "pro-pit-associates-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "associates",
        collection: "all"
      },
      label: "Aggregate associates",
      inputType: "number"
    },
    "pro-pit-goal-trees-restored-description": {
      property: "goalTreesRestoredDescription",
      label: "How did you calculate the estimated number of trees planted-restored?",
      inputType: "long-text"
    },
    "pro-pit-jobs-created-beneficiaries-description": {
      property: "jobsCreatedBeneficiariesDescription",
      label:
        "How did you arrive at the provided estimate of number of jobs created, direct and indirect beneficiaries?",
      inputType: "long-text"
    }
  },
  fileCollections: {
    "pro-pit-fcol-cover": { collection: "cover", label: "Cover Image", inputType: "file", multiChoice: false },
    "pro-pit-fcol-add": {
      collection: "additional",
      label: "Additional documents",
      inputType: "file",
      multiChoice: true
    },
    "pro-pit-fcol-rest-photos": {
      collection: "restoration_photos",
      label: "Past Restoration Photos",
      inputType: "file",
      multiChoice: true
    },
    "pro-pit-fcol-detail-proj-bdgt": {
      collection: "detailed_project_budget",
      label: "Detailed project budget",
      inputType: "file",
      multiChoice: false
    },
    "pro-pit-proof-of-land-tenure-mou": {
      collection: "proof_of_land_tenure_mou",
      label: "Proof of land tenure MOU",
      inputType: "file",
      multiChoice: true
    }
  },
  relations: {
    "pro-pit-tree-species": {
      label: "Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "tree-planted"
    },
    "pro-pit-all-jobs": {
      label: "All Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "all"
    },
    "pro-pit-full-time-jobs": {
      label: "Full-time Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "full-time"
    },
    "pro-pit-part-time-jobs": {
      label: "Part-time Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "part-time"
    },
    "pro-pit-volunteers": {
      label: "Volunteers",
      resource: "demographics",
      inputType: "volunteers",
      collection: "volunteer"
    },
    "pro-pit-all-beneficiaries": {
      label: "All Beneficiaries",
      resource: "demographics",
      inputType: "allBeneficiaries",
      collection: "all"
    },
    "pro-pit-indirect-beneficiaries": {
      label: "Indirect Beneficiaries",
      resource: "demographics",
      inputType: "indirectBeneficiaries",
      collection: "indirect"
    }
  }
};
