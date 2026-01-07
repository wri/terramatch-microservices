import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { Project } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const ProjectConfiguration: LinkedFieldConfiguration<Project> = {
  label: "Project",
  fields: {
    "pro-name": { property: "name", label: "Name", inputType: "text" },
    "pro-land-use-types": {
      property: "landUseTypes",
      label: "Land use types",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "land-use-systems"
    },
    "pro-restoration_strategy": {
      property: "restorationStrategy",
      label: "Restoration strategy",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-strategies"
    },
    "pro-income-generating-activities": {
      property: "incomeGeneratingActivities",
      label: "Income generating activities",
      inputType: "select",
      multiChoice: true,
      optionListKey: "income-generating-activities"
    },
    "pro-land-tenure-proj-area": {
      property: "landTenureProjectArea",
      label: "Land tenure",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "land-tenures"
    },
    "pro-country": {
      property: "country",
      label: "Country",
      inputType: "select",
      multiChoice: false,
      optionListKey: "gadm-level-0"
    },
    "pro-continent": {
      property: "continent",
      label: "Continent",
      inputType: "select",
      multiChoice: false,
      optionListKey: "continents"
    },
    "pro-plant_start_dte": { property: "plantingStartDate", label: "planting start date", inputType: "date" },
    "pro-plant_end_dte": { property: "plantingEndDate", label: "Planting end date", inputType: "date" },
    "pro-description": { property: "description", label: "Description", inputType: "long-text" },
    "pro-history": { property: "history", label: "History", inputType: "long-text" },
    "pro-objectives": { property: "objectives", label: "Objectives", inputType: "long-text" },
    "pro-environmental-goals": {
      property: "environmentalGoals",
      label: "Environmental goals",
      inputType: "long-text"
    },
    "pro-socioeconomic-goals": {
      property: "socioeconomicGoals",
      label: "Socioeconomic goals",
      inputType: "long-text"
    },
    "pro-sdgs-impacted": {
      property: "sdgsImpacted",
      label: "SDGS impacted",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "sdgs-impacted-type"
    },
    "pro-long-term-growth": { property: "longTermGrowth", label: "Long term growth", inputType: "long-text" },
    "pro-community-incentives": {
      property: "communityIncentives",
      label: "Community incentives",
      inputType: "long-text"
    },
    "pro-budget": { property: "budget", label: "budget", inputType: "number" },
    "pro-jobs-created-goal": { property: "jobsCreatedGoal", label: "Jobs created goal", inputType: "number" },
    "pro-total-hectares-restored-goal": {
      property: "totalHectaresRestoredGoal",
      label: "Total hectares restored goal",
      inputType: "number"
    },
    "pro-trees-grown-goal": { property: "treesGrownGoal", label: "Trees grown goal", inputType: "number" },
    "pro-survival-rate": { property: "survivalRate", label: "Survival rate", inputType: "number" },
    "pro-year-five-crown-cover": {
      property: "yearFiveCrownCover",
      label: "Year five crown cover",
      inputType: "number"
    },
    "pro-monitored-tree-cover": {
      property: "monitoredTreeCover",
      label: "monitored tree cover",
      inputType: "number"
    },
    "pro-organization-name": { property: "organizationName", label: "Organisation Name", inputType: "text" },
    "pro-county-district": { property: "projectCountyDistrict", label: "Project District", inputType: "text" },
    "pro-desc-of-proj-timeline": {
      property: "descriptionOfProjectTimeline",
      label: "Key stages of this project’s implementation",
      inputType: "long-text"
    },
    "pro-siting-strategy-description": {
      property: "sitingStrategyDescription",
      label: "Siting Strategy Description",
      inputType: "long-text"
    },
    "pro-siting-strategy": {
      property: "sitingStrategy",
      label: "Siting Strategy",
      inputType: "select",
      multiChoice: false,
      optionListKey: "siting-strategies"
    },
    "pro-landholder-comm-engage": {
      property: "landholderCommEngage",
      label: "Landholder & Community Engagement Strategy",
      inputType: "long-text"
    },
    "pro-proj-partner-info": {
      property: "projPartnerInfo",
      label: "Proposed project partner information",
      inputType: "long-text"
    },
    "pro-proj-success-risks": {
      property: "projSuccessRisks",
      label: "Risk + Mitigate strategy",
      inputType: "long-text"
    },
    "pro-monitor-eval-plan": {
      property: "monitorEvalPlan",
      label: "Report, Monitor, Verification Strategy",
      inputType: "long-text"
    },
    "pro-seedlings-source": {
      property: "seedlingsSource",
      label: "Sources of tree seedlings for the project",
      inputType: "long-text"
    },
    "pro-pct-employees-men": {
      property: "pctEmployeesMen",
      label: "% of total employees that would be men",
      inputType: "number-percentage"
    },
    "pro-pct-employees-women": {
      property: "pctEmployeesWomen",
      label: "% of total employees that would be women",
      inputType: "number-percentage"
    },
    "pro-pct-employees-18to35": {
      property: "pctEmployees18To35",
      label: "% of total employees that would be between the ages of 18 and 35",
      inputType: "number-percentage"
    },
    "pro-pct-employees-older35": {
      property: "pctEmployeesOlder35",
      label: "% of total employees that would be older than 35 years of age",
      inputType: "number-percentage"
    },
    "pro-pct-employees-marginalised": {
      property: "pctEmployeesMarginalised",
      label: "% of total employees that would be part of a marginalised community",
      inputType: "number-percentage"
    },
    "pro-beneficiaries": { property: "projBeneficiaries", label: "Project beneficiaries Total", inputType: "number" },
    "pro-pct-beneficiaries-women": {
      property: "pctBeneficiariesWomen",
      label: "% of female beneficiaries",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-men": {
      property: "pctBeneficiariesMen",
      label: "% Beneficiaries men",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-small": {
      property: "pctBeneficiariesSmall",
      label: "% of smallholder farmers beneficiaries",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-large": {
      property: "pctBeneficiariesLarge",
      label: "% of large-scale farmers beneficiaries",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-35below": {
      property: "pctBeneficiariesYouth",
      label: "% of beneficiaries younger than 36",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-marginalised": {
      property: "pctBeneficiariesMarginalised",
      label: "% Beneficiaries Marginalised Communities",
      inputType: "number-percentage"
    },
    "pro-detailed-rst-inv-types": {
      property: "detailedInterventionTypes",
      label: "Detailed intervention types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "interventions"
    },
    "pro-proj-impact-foodsec": {
      property: "projImpactFoodsec",
      label: "Potential project impact: food security",
      inputType: "long-text"
    },
    // This is breaking convention for linked field keys because project pitch was already using pro-proposed-gov-partners.
    "project-proposed-gov-partners": {
      property: "proposedGovPartners",
      label: "Proposed government partners",
      inputType: "long-text"
    },
    "pro-proposed-num-nurseries": {
      property: "proposedNumNurseries",
      label: "Proposed Number of Nurseries",
      inputType: "number"
    },
    "pro-proj-boundary": { virtual: { type: "projectBoundary" }, label: "Project Boundary", inputType: "mapInput" },
    "pro-states": {
      property: "states",
      label: "States",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-1"
    },
    "pro-impact-biodiv": {
      property: "projImpactBiodiv",
      label: "Biodiversity Impact (project)",
      inputType: "long-text"
    },
    // This is breaking convention for linked field keys because project pitch was already using pro-water-source.
    "project-water-source": { property: "waterSource", label: "Water Source", inputType: "long-text" },
    "pro-baseline-biodiversity": {
      property: "baselineBiodiversity",
      label: "Baseline Biodiversity Conditions",
      inputType: "long-text"
    },
    "pro-goal-trees-restored-planting": {
      property: "goalTreesRestoredPlanting",
      label: "Trees Restored Goal - Planting",
      inputType: "number"
    },
    "pro-goal-trees-restored-anr": {
      property: "goalTreesRestoredAnr",
      label: "Trees Restored Goal - ANR",
      inputType: "number"
    },
    "pro-goal-trees-restored-direct-seeding": {
      property: "goalTreesRestoredDirectSeeding",
      label: "Trees Restored Goal - Direct Seeding",
      inputType: "number"
    },
    "pro-direct-seeding-survival-rate": {
      property: "directSeedingSurvivalRate",
      label: "Direct Seeding Survival Rate",
      inputType: "number-percentage"
    },
    "pro-full-time-jobs-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "jobs",
        collection: "full-time"
      },
      label: "Aggregate full time jobs",
      inputType: "number"
    },
    "pro-full-clt-time-jobs-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "jobs",
        collection: "full-time-clt"
      },
      label: "Aggregate full time CLT jobs",
      inputType: "number"
    },
    "pro-part-time-jobs-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "jobs",
        collection: "part-time"
      },
      label: "Aggregate part time jobs",
      inputType: "number"
    },
    "pro-part-clt-time-jobs-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "jobs",
        collection: "part-time-clt"
      },
      label: "Aggregate part time CLT jobs",
      inputType: "number"
    },
    "pro-volunteers-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "volunteers",
        collection: "volunteer"
      },
      label: "Aggregate volunteers",
      inputType: "number"
    },
    "pro-beneficiaries-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "all-beneficiaries",
        collection: "all"
      },
      label: "Aggregate beneficiaries",
      inputType: "number"
    },
    "pro-indirect-beneficiaries-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "indirect-beneficiaries",
        collection: "indirect"
      },
      label: "Aggregate indirect beneficiaries",
      inputType: "number"
    },
    "pro-associates-count": {
      virtual: {
        type: "demographicsAggregate",
        demographicsType: "associates",
        collection: "all"
      },
      label: "Aggregate associates",
      inputType: "number"
    }
  },
  fileCollections: {
    "pro-col-media": { collection: "media", label: "Media", inputType: "file", multiChoice: true },
    "pro-col-socioeconomic-benefits": {
      collection: "socioeconomic_benefits",
      label: "Socioeconomic benefits",
      inputType: "file",
      multiChoice: true
    },
    "pro-col-file": { collection: "file", label: "File", inputType: "file", multiChoice: true },
    "pro-col-other-additional-documents": {
      collection: "other_additional_documents",
      label: "Other additional documents",
      inputType: "file",
      multiChoice: true
    },
    "pro-col-photos": { collection: "photos", label: "Photos", inputType: "file", multiChoice: true },
    "pro-col-document-files": {
      collection: "document_files",
      label: "Document Files",
      inputType: "file",
      multiChoice: true
    },
    "pro-col-programme-submission": {
      collection: "programme_submission",
      label: "programme_submission",
      inputType: "file",
      multiChoice: true
    },
    "pro-col-detailed-project-budget": {
      collection: "detailed_project_budget",
      label: "Detailed project budget",
      inputType: "file",
      multiChoice: false
    },
    "pro-col-proof-of-land-tenure-mou": {
      collection: "proof_of_land_tenure_mou",
      label: "Documentation on project area’s land tenure",
      inputType: "file",
      multiChoice: true
    }
  },
  relations: {
    "pro-pit-rel-tree-species": {
      label: "Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "tree-planted"
    },
    "pro-all-jobs": {
      label: "All Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "all"
    },
    "pro-full-time-jobs": {
      label: "Full-time Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "full-time"
    },
    "pro-part-time-jobs": {
      label: "Part-time Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "part-time"
    },
    "pro-volunteers": {
      label: "Volunteers",
      resource: "demographics",
      inputType: "volunteers",
      collection: "volunteer"
    },
    "pro-all-beneficiaries": {
      label: "All Beneficiaries",
      resource: "demographics",
      inputType: "allBeneficiaries",
      collection: "all"
    },
    "pro-indirect-beneficiaries": {
      label: "Indirect Beneficiaries",
      resource: "demographics",
      inputType: "indirectBeneficiaries",
      collection: "indirect"
    }
  }
};
