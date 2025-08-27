import { LinkedFieldConfiguration } from "../types";
import { Project } from "@terramatch-microservices/database/entities";

export const ProjectConfiguration: LinkedFieldConfiguration = {
  label: "Project",
  laravelModelType: Project.LARAVEL_TYPE,
  fields: {
    "pro-name": { property: "name", label: "Name", inputType: "text" },
    "pro-land-use-types": {
      property: "land_use_types",
      label: "Land use types",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-systems"
    },
    "pro-restoration_strategy": {
      property: "restoration_strategy",
      label: "Restoration strategy",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-practices"
    },
    "pro-land-tenure-proj-area": {
      property: "land_tenure_project_area",
      label: "Land tenure",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "project-land-tenures"
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
    "pro-plant_start_dte": { property: "planting_start_date", label: "planting start date", inputType: "date" },
    "pro-plant_end_dte": { property: "planting_end_date", label: "Planting end date", inputType: "date" },
    "pro-description": { property: "description", label: "Description", inputType: "long-text" },
    "pro-history": { property: "history", label: "History", inputType: "long-text" },
    "pro-objectives": { property: "objectives", label: "Objectives", inputType: "long-text" },
    "pro-environmental-goals": {
      property: "environmental_goals",
      label: "Environmental goals",
      inputType: "long-text"
    },
    "pro-socioeconomic-goals": {
      property: "socioeconomic_goals",
      label: "Socioeconomic goals",
      inputType: "long-text"
    },
    "pro-sdgs-impacted": {
      property: "sdgs_impacted",
      label: "SDGS impacted",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "sdgs-impacted-type"
    },
    "pro-long-term-growth": { property: "long_term_growth", label: "Long term growth", inputType: "long-text" },
    "pro-community-incentives": {
      property: "community_incentives",
      label: "Community incentives",
      inputType: "long-text"
    },
    "pro-budget": { property: "budget", label: "budget", inputType: "number" },
    "pro-jobs-created-goal": { property: "jobs_created_goal", label: "Jobs created goal", inputType: "number" },
    "pro-total-hectares-restored-goal": {
      property: "total_hectares_restored_goal",
      label: "Total hectares restored goal",
      inputType: "number"
    },
    "pro-trees-grown-goal": { property: "trees_grown_goal", label: "Trees grown goal", inputType: "number" },
    "pro-survival-rate": { property: "survival_rate", label: "Survival rate", inputType: "number" },
    "pro-year-five-crown-cover": {
      property: "year_five_crown_cover",
      label: "Year five crown cover",
      inputType: "number"
    },
    "pro-monitored-tree-cover": {
      property: "monitored_tree_cover",
      label: "monitored tree cover",
      inputType: "number"
    },
    "pro-organization-name": { property: "organization_name", label: "Organisation Name", inputType: "text" },
    "pro-county-district": { property: "project_county_district", label: "Project District", inputType: "text" },
    "pro-desc-of-proj-timeline": {
      property: "description_of_project_timeline",
      label: "Key stages of this project's implementation",
      inputType: "long-text"
    },
    "pro-siting-strategy-description": {
      property: "siting_strategy_description",
      label: "Siting Strategy Description",
      inputType: "long-text"
    },
    "pro-siting-strategy": {
      property: "siting_strategy",
      label: "Siting Strategy",
      inputType: "select",
      multiChoice: false,
      optionListKey: "siting-strategy"
    },
    "pro-landholder-comm-engage": {
      property: "landholder_comm_engage",
      label: "Landholder & Community Engagement Strategy",
      inputType: "long-text"
    },
    "pro-proj-partner-info": {
      property: "proj_partner_info",
      label: "Proposed project partner information",
      inputType: "long-text"
    },
    "pro-proj-success-risks": {
      property: "proj_success_risks",
      label: "Risk + Mitigate strategy",
      inputType: "long-text"
    },
    "pro-monitor-eval-plan": {
      property: "monitor_eval_plan",
      label: "Report, Monitor, Verification Strategy",
      inputType: "long-text"
    },
    "pro-seedlings-source": {
      property: "seedlings_source",
      label: "Sources of tree seedlings for the project",
      inputType: "long-text"
    },
    "pro-pct-employees-men": {
      property: "pct_employees_men",
      label: "% of total employees that would be men",
      inputType: "number-percentage"
    },
    "pro-pct-employees-women": {
      property: "pct_employees_women",
      label: "% of total employees that would be women",
      inputType: "number-percentage"
    },
    "pro-pct-employees-18to35": {
      property: "pct_employees_18to35",
      label: "% of total employees that would be between the ages of 18 and 35",
      inputType: "number-percentage"
    },
    "pro-pct-employees-older35": {
      property: "pct_employees_older35",
      label: "% of total employees that would be older than 35 years of age",
      inputType: "number-percentage"
    },
    "pro-pct-employees-marginalised": {
      property: "pct_employees_marginalised",
      label: "% of total employees that would be part of a marginalised community",
      inputType: "number-percentage"
    },
    "pro-beneficiaries": { property: "proj_beneficiaries", label: "Project beneficiaries Total", inputType: "number" },
    "pro-pct-beneficiaries-women": {
      property: "pct_beneficiaries_women",
      label: "% of female beneficiaries",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-men": {
      property: "pct_beneficiaries_men",
      label: "% Beneficiaries men",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-small": {
      property: "pct_beneficiaries_small",
      label: "% of smallholder farmers beneficiaries",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-large": {
      property: "pct_beneficiaries_large",
      label: "% of large-scale farmers beneficiaries",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-35below": {
      property: "pct_beneficiaries_youth",
      label: "% of beneficiaries younger than 36",
      inputType: "number-percentage"
    },
    "pro-pct-beneficiaries-marginalised": {
      property: "pct_beneficiaries_marginalised",
      label: "% Beneficiaries Marginalised Communities",
      inputType: "number-percentage"
    },
    "pro-detailed-rst-inv-types": {
      property: "detailed_intervention_types",
      label: "Detailed intervention types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "interventions"
    },
    "pro-proj-impact-foodsec": {
      property: "proj_impact_foodsec",
      label: "Potential project impact: food security",
      inputType: "long-text"
    },
    // This is breaking convention for linked field keys because project pitch was already using pro-proposed-gov-partners.
    "project-proposed-gov-partners": {
      property: "proposed_gov_partners",
      label: "Proposed government partners",
      inputType: "long-text"
    },
    "pro-proposed-num-nurseries": {
      property: "proposed_num_nurseries",
      label: "Proposed Number of Nurseries",
      inputType: "number"
    },
    "pro-proj-boundary": { property: "proj_boundary", label: "Project Boundary", inputType: "mapInput" },
    "pro-states": {
      property: "states",
      label: "States",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-1"
    },
    "pro-impact-biodiv": {
      property: "proj_impact_biodiv",
      label: "Biodiversity Impact (project)",
      inputType: "long-text"
    },
    // This is breaking convention for linked field keys because project pitch was already using pro-water-source.
    "project-water-source": { property: "water_source", label: "Water Source", inputType: "long-text" },
    "pro-baseline-biodiversity": {
      property: "baseline_biodiversity",
      label: "Baseline Biodiversity Conditions",
      inputType: "long-text"
    },
    "pro-goal-trees-restored-planting": {
      property: "goal_trees_restored_planting",
      label: "Trees Restored Goal - Planting",
      inputType: "number"
    },
    "pro-goal-trees-restored-anr": {
      property: "goal_trees_restored_anr",
      label: "Trees Restored Goal - ANR",
      inputType: "number"
    },
    "pro-goal-trees-restored-direct-seeding": {
      property: "goal_trees_restored_direct_seeding",
      label: "Trees Restored Goal - Direct Seeding",
      inputType: "number"
    },
    "pro-direct-seeding-survival-rate": {
      property: "direct_seeding_survival_rate",
      label: "Direct Seeding Survival Rate",
      inputType: "number-percentage"
    },
    "pro-full-time-jobs-count": {
      property: "full_time_jobs_aggregate",
      label: "Aggregate full time jobs",
      inputType: "number"
    },
    "pro-full-clt-time-jobs-count": {
      property: "full_time_clt_jobs_aggregate",
      label: "Aggregate full time CLT jobs",
      inputType: "number"
    },
    "pro-part-time-jobs-count": {
      property: "part_time_jobs_aggregate",
      label: "Aggregate part time jobs",
      inputType: "number"
    },
    "pro-part-clt-time-jobs-count": {
      property: "part_time_clt_jobs_aggregate",
      label: "Aggregate part time CLT jobs",
      inputType: "number"
    },
    "pro-volunteers-count": { property: "volunteers_aggregate", label: "Aggregate volunteers", inputType: "number" },
    "pro-beneficiaries-count": {
      property: "all_beneficiaries_aggregate",
      label: "Aggregate beneficiaries",
      inputType: "number"
    },
    "pro-indirect-beneficiaries-count": {
      property: "indirect_beneficiaries_aggregate",
      label: "Aggregate indirect beneficiaries",
      inputType: "number"
    },
    "pro-associates-count": { property: "all_associates_aggregate", label: "Aggregate associates", inputType: "number" }
  },
  fileCollections: {
    "pro-col-media": { property: "media", label: "Media", inputType: "file", multiChoice: true },
    "pro-col-socioeconomic-benefits": {
      property: "socioeconomic_benefits",
      label: "Socioeconomic benefits",
      inputType: "file",
      multiChoice: true
    },
    "pro-col-file": { property: "file", label: "File", inputType: "file", multiChoice: true },
    "pro-col-other-additional-documents": {
      property: "other_additional_documents",
      label: "Other additional documents",
      inputType: "file",
      multiChoice: true
    },
    "pro-col-photos": { property: "photos", label: "Photos", inputType: "file", multiChoice: true },
    "pro-col-document-files": {
      property: "document_files",
      label: "Document Files",
      inputType: "file",
      multiChoice: true
    },
    "pro-col-programme-submission": {
      property: "programme_submission",
      label: "Programme Submission",
      inputType: "file",
      multiChoice: true
    },
    "pro-col-detailed-project-budget": {
      property: "detailed_project_budget",
      label: "Detailed project budget",
      inputType: "file",
      multiChoice: false
    },
    "pro-col-proof-of-land-tenure-mou": {
      property: "proof_of_land_tenure_mou",
      label: "Documentation on project area's land tenure",
      inputType: "file",
      multiChoice: true
    }
  },
  relations: {
    "pro-pit-rel-tree-species": {
      property: "treeSpecies",
      label: "Tree Species",
      resource: "App\\Http\\Resources\\V2\\TreeSpecies\\TreeSpeciesResource",
      inputType: "treeSpecies",
      collection: "tree-planted"
    },
    "pro-all-jobs": {
      property: "jobsAll",
      label: "All Jobs",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "jobs",
      collection: "all"
    },
    "pro-full-time-jobs": {
      property: "jobsFullTime",
      label: "Full-time Jobs",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "jobs",
      collection: "full-time"
    },
    "pro-part-time-jobs": {
      property: "jobsPartTime",
      label: "Part-time Jobs",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "jobs",
      collection: "part-time"
    },
    "pro-volunteers": {
      property: "volunteers",
      label: "Volunteers",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "volunteers",
      collection: "volunteer"
    },
    "pro-all-beneficiaries": {
      property: "allBeneficiaries",
      label: "All Beneficiaries",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "allBeneficiaries",
      collection: "all"
    },
    "pro-indirect-beneficiaries": {
      property: "indirectBeneficiaries",
      label: "Indirect Beneficiaries",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "indirectBeneficiaries",
      collection: "indirect"
    }
  }
};
