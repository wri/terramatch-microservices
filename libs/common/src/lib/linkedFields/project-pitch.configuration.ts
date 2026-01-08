import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { ProjectPitch } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const ProjectPitchConfiguration: LinkedFieldConfiguration = {
  label: "Project Pitch",
  laravelModelType: ProjectPitch.LARAVEL_TYPE,
  fields: {
    "pro-pit-name": { property: "project_name", label: "Name", inputType: "text" },
    "pro-pit-objectives": { property: "project_objectives", label: "Objectives", inputType: "long-text" },
    "pro-pit-district": { property: "project_county_district", label: "County district", inputType: "text" },
    "pro-pit-country": {
      property: "project_country",
      label: "Country",
      inputType: "select",
      multiChoice: false,
      optionListKey: "gadm-level-0"
    },
    "pro-pit-rst-inv-types": {
      property: "restoration_intervention_types",
      label: "Restoration intervention types",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "land-use-systems"
    },
    "pro-pit-detailed-rst-inv-types": {
      property: "detailed_intervention_types",
      label: "Detailed intervention types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "interventions"
    },
    "pro-pit-tot-ha": { property: "total_hectares", label: "Total hectares", inputType: "number" },
    "pro-pit-tot-trees": { property: "total_trees", label: "Total trees", inputType: "number" },
    "pro-pit-bgt": { property: "project_budget", label: "Project budget", inputType: "number" },
    "pro-pit-cap-bld-needs": {
      property: "capacity_building_needs",
      label: "Capacity building needs",
      inputType: "select",
      multiChoice: true,
      optionListKey: "building-needs"
    },
    "pro-pit-how-discovered": {
      property: "how_discovered",
      label: "How discovered WRI",
      inputType: "select",
      multiChoice: true,
      optionListKey: "media-channels"
    },
    "pro-pit-land-tenure-proj-area": {
      property: "land_tenure_proj_area",
      label: "Land tenure project area",
      inputType: "select",
      multiChoice: true,
      optionListKey: "land-tenures-brazil"
    },
    "pro-pit-expected-active-rest-start-date": {
      property: "expected_active_restoration_start_date",
      label: "Expected active restoration start date",
      inputType: "date"
    },
    "pro-pit-expected-active-rest-end-date": {
      property: "expected_active_restoration_end_date",
      label: "Expected active restoration end date",
      inputType: "date"
    },
    "pro-pit-desc-of-proj-timeline": {
      property: "description_of_project_timeline",
      label: "Description of project timeline",
      inputType: "long-text"
    },
    "pro-pit-proj-partner-info": {
      property: "proj_partner_info",
      label: "Project partner info",
      inputType: "long-text"
    },
    "pro-pit-landholder-comm-engage": {
      property: "landholder_comm_engage",
      label: "Landholder & Community Engagement Strategy",
      inputType: "long-text"
    },
    "pro-pit-proj-success-risks": {
      property: "proj_success_risks",
      label: "Project risks to success",
      inputType: "long-text"
    },
    "pro-pit-monitor-eval-plan": {
      property: "monitor_eval_plan",
      label: "Monitoring and evaluation plan",
      inputType: "long-text"
    },
    "pro-pit-proj-boundary": { property: "proj_boundary", label: "Project Boundary", inputType: "mapInput" },
    "pro-pit-sustainable-dev-goals": {
      property: "sustainable_dev_goals",
      label: "Sustainable Development Goals",
      inputType: "select-image",
      multiChoice: true
    },
    "pro-pit-proj-area-desc": {
      property: "proj_area_description",
      label: "Description of Project Area",
      inputType: "long-text"
    },
    "pro-pit-curr-land-degradation": {
      property: "curr_land_degradation",
      label: "Main causes of degradation",
      inputType: "long-text"
    },
    "pro-pit-proposed-num-sites": {
      property: "proposed_num_sites",
      label: "Proposed Number of Sites",
      inputType: "number"
    },
    "pro-pit-environmental-goals": {
      property: "environmental_goals",
      label: "Environmental goals",
      inputType: "long-text"
    },
    "pro-pit-proposed-num-nurseries": {
      property: "proposed_num_nurseries",
      label: "Proposed Number of Nurseries",
      inputType: "number"
    },
    "pro-pit-proj-impact-socieconom": {
      property: "proj_impact_socieconom",
      label: "Potential project impact: socioeconomic",
      inputType: "long-text"
    },
    "pro-pit-proj-impact-foodsec": {
      property: "proj_impact_foodsec",
      label: "Potential project impact: food security",
      inputType: "long-text"
    },
    "pro-pit-proj-impact-watersec": {
      property: "proj_impact_watersec",
      label: "Potential project impact: water security",
      inputType: "long-text"
    },
    "pro-pit-proj-impact-jobtypes": {
      property: "proj_impact_jobtypes",
      label: "Potential project impact: types of jobs created",
      inputType: "long-text"
    },
    "pro-pit-num-jobs-created": { property: "num_jobs_created", label: "Number of jobs created", inputType: "number" },
    "pro-pit-beneficiaries": {
      property: "proj_beneficiaries",
      label: "Total Expected project beneficiaries",
      inputType: "number"
    },
    "pro-pit-pct-beneficiaries-small": {
      property: "pct_beneficiaries_small",
      label: "% Beneficiaries smallholder",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-large": {
      property: "pct_beneficiaries_large",
      label: "% Beneficiaries large",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-women": {
      property: "pct_beneficiaries_women",
      label: "% Beneficiaries women",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-men": {
      property: "pct_beneficiaries_men",
      label: "% Beneficiaries men",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-35below": {
      property: "pct_beneficiaries_youth",
      label: "% Beneficiaries youth",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-sch-classes": {
      property: "pct_beneficiaries_scheduled_classes",
      label: "% Beneficiaries Scheduled Classes",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-sch-tribes": {
      property: "pct_beneficiaries_scheduled_tribes",
      label: "% Beneficiaries Scheduled Tribes",
      inputType: "number-percentage"
    },
    "pro-pit-pct-beneficiaries-marginalised": {
      property: "pct_beneficiaries_marginalised",
      label: "% Beneficiaries Marginalised Communities",
      inputType: "number-percentage"
    },
    "pro-pit-main-degradation_causes": {
      property: "main_degradation_causes",
      label: "Main degradation causes",
      inputType: "long-text"
    },
    "pro-pit-seedlings-source": { property: "seedlings_source", label: "Seedlings source", inputType: "long-text" },
    "pro-pit-pct-employees-men": {
      property: "pct_employees_men",
      label: "% of total employees that would be men",
      inputType: "number-percentage"
    },
    "pro-pit-pct-employees-women": {
      property: "pct_employees_women",
      label: "% of total employees that would be women",
      inputType: "number-percentage"
    },
    "pro-pit-pct-employees-18to35": {
      property: "pct_employees_18to35",
      label: "% of total employees that would be between the ages of 18 and 35",
      inputType: "number-percentage"
    },
    "pro-pit-pct-employees-older35": {
      property: "pct_employees_older35",
      label: "% of total employees that would be older than 35 years of age",
      inputType: "number-percentage"
    },
    "pro-pit-pct-employees-marginalised": {
      property: "pct_employees_marginalised",
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
      property: "hectares_first_yr",
      label: "Hectares to be restored in the first year",
      inputType: "number"
    },
    "pro-pit-trees-yr1": {
      property: "total_trees_first_yr",
      label: "Trees planted in the first year",
      inputType: "number"
    },
    "pro-pit-pct-beneficiaries-backward-class": {
      property: "pct_beneficiaries_backward_class",
      label: "% Beneficiaries backward class",
      inputType: "number-percentage"
    },
    "pro-pit-land-systems": {
      property: "land_systems",
      label: "Land systems",
      inputType: "select",
      multiChoice: true,
      optionListKey: "land-use-systems"
    },
    "pro-pit-tree-rest-prac": {
      property: "tree_restoration_practices",
      label: "Tree Restoration Practices",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-strategies"
    },
    "pro-pit-main-cause-deg": {
      property: "main_causes_of_degradation",
      label: "Main causes of degradation",
      inputType: "long-text"
    },
    "pro-theory-of-change": { property: "theory_of_change", label: "Theory of change", inputType: "long-text" },
    "pro-proposed-gov-partners": {
      property: "proposed_gov_partners",
      label: "Proposed government partners",
      inputType: "long-text"
    },
    "pro-pct-sch-tribe": {
      property: "pct_sch_tribe",
      label: "% of total employees that would be Scheduled Caste/Other Backward Class/Scheduled Tribe",
      inputType: "number-percentage"
    },
    "pro-sustainability-plan": {
      property: "sustainability_plan",
      label: "Project sustainability plan",
      inputType: "long-text"
    },
    "pro-replication-plan": { property: "replication_plan", label: "Project replication plan", inputType: "long-text" },
    "pro-replication-challenges": {
      property: "replication_challenges",
      label: "Project replication challenges",
      inputType: "long-text"
    },
    "pro-solution-market-size": {
      property: "solution_market_size",
      label: "Solution market size",
      inputType: "long-text"
    },
    "pro-affordability-of-solution": {
      property: "affordability_of_solution",
      label: "Affordability of solution/products",
      inputType: "long-text"
    },
    "pro-growth-trends-business": {
      property: "growth_trends_business",
      label: "Growth trends of business",
      inputType: "long-text"
    },
    "pro-limitations-on-scope": {
      property: "limitations_on_scope",
      label: "Limitations on scope of operations",
      inputType: "long-text"
    },
    "pro-business-model-replication_plan": {
      property: "business_model_replication_plan",
      label: "Business model replication plan",
      inputType: "long-text"
    },
    "pro-biodiversity-impact": {
      property: "biodiversity_impact",
      label: "Biodiversity Impact (project)",
      inputType: "long-text"
    },
    "pro-water-source": { property: "water_source", label: "Water Source (project)", inputType: "long-text" },
    "pro-climate-resilience": {
      property: "climate_resilience",
      label: "Climate resilience (project)",
      inputType: "long-text"
    },
    "pro-soil-health": { property: "soil_health", label: "Soil Health (project)", inputType: "long-text" },
    "pro-pit-land-use-types": {
      property: "land_use_types",
      label: "Land use types",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "land-use-systems"
    },
    "pro-pit-restoration_strategy": {
      property: "restoration_strategy",
      label: "Restoration strategy",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-strategies"
    },
    "pro-pit-baseline-biodiversity": {
      property: "baseline_biodiversity",
      label: "Baseline Biodiversity Conditions",
      inputType: "long-text"
    },
    "pro-pit-goal-trees-restored-planting": {
      property: "goal_trees_restored_planting",
      label: "Trees Restored Goal - Planting",
      inputType: "number"
    },
    "pro-pit-goal-trees-restored-anr": {
      property: "goal_trees_restored_anr",
      label: "Trees Restored Goal - ANR",
      inputType: "number"
    },
    "pro-pit-goal-trees-restored-direct-seeding": {
      property: "goal_trees_restored_direct_seeding",
      label: "Trees Restored Goal - Direct Seeding",
      inputType: "number"
    },
    "pro-pit-direct-seeding-survival-rate": {
      property: "direct_seeding_survival_rate",
      label: "Direct Seeding Survival Rate",
      inputType: "number-percentage"
    },
    "pro-pit-level-0-proposed": {
      property: "level_0_proposed",
      label: "countries where project will be restoring land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-0"
    },
    "pro-pit-level-1-proposed": {
      property: "level_1_proposed",
      label: "GADM level 1 administrative areas where project will be restoring land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-1"
    },
    "pro-pit-level-2-proposed": {
      property: "level_2_proposed",
      label: "GADM level 2 administrative areas where project will be restoring land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-2"
    },
    "pro-pit-lat-proposed": {
      property: "lat_proposed",
      label: "Proposed center point of a restoration site - latitude",
      inputType: "number"
    },
    "pro-pit-long-proposed": {
      property: "long_proposed",
      label: "Proposed center point of a restoration site - longitude",
      inputType: "number"
    },
    "pro-pit-stakeholder-engagement": {
      property: "stakeholder_engagement",
      label: "Local stakeholders affected by project",
      inputType: "long-text"
    },
    "pro-pit-landowner-agreement": {
      property: "landowner_agreement",
      label: "Prior agreement with landowner to use their land for restoration",
      inputType: "select",
      multiChoice: false,
      optionListKey: "landowner-collection"
    },
    "pro-pit-landowner-agreement-description": {
      property: "landowner_agreement_description",
      label: "Explanation of landowner agreement",
      inputType: "long-text"
    },
    "pro-pit-land-tenure-risks": {
      property: "land_tenure_risks",
      label: "Risks or challenges in securing tenure arrangements with landowners",
      inputType: "long-text"
    },
    "pro-pit-non-tree-interventions-description": {
      property: "non_tree_interventions_description",
      label: "Additional non-tree intervention description",
      inputType: "long-text"
    },
    "pro-pit-complement-existing-restoration": {
      property: "complement_existing_restoration",
      label: "Project complements existing restoration",
      inputType: "long-text"
    },
    "pro-pit-restoration-strategy-distribution": {
      property: "restoration_strategy_distribution",
      label: "Distribution of restoration strategies",
      inputType: "strategy-area",
      multiChoice: false,
      optionListKey: "restoration-strategies"
    },
    "pro-pit-land-use-type-distribution": {
      property: "land_use_type_distribution",
      label: "Distribution of land use systems",
      inputType: "strategy-area",
      multiChoice: false,
      optionListKey: "land-use-systems"
    },
    "pro-pit-land-tenure-distribution": {
      property: "land_tenure_distribution",
      label: "Distribution of land tenure agreement",
      inputType: "strategy-area",
      multiChoice: false,
      optionListKey: "land-tenures"
    },
    "pro-pit-total-tree-second-yr": {
      property: "total_tree_second_yr",
      label: "Trees Planted in Second Year",
      inputType: "number"
    },
    "pro-pit-proj-survival-rate": {
      property: "proj_survival_rate",
      label: "Projected Project Survival Rate",
      inputType: "number-percentage"
    },
    "pro-pit-anr-approach": { property: "anr_approach", label: "Project Approach to ANR", inputType: "text" },
    "pro-pit-anr-rights": { property: "anr_rights", label: "How to Secure Rights to Conduct ANR", inputType: "text" },
    "pro-pit-project-site-model": {
      property: "project_site_model",
      label: "Project site distribution model",
      inputType: "select",
      multiChoice: false,
      optionListKey: "siting-strategies"
    },
    "pro-pit-indigenous-impact": {
      property: "indigenous_impact",
      label: "Project Impacts or Benefits for Indigenous People",
      inputType: "text"
    },
    "pro-pit-barriers-project-activity": {
      property: "barriers_project_activity",
      label: "Barriers to Project Activities",
      inputType: "select",
      multiChoice: true,
      optionListKey: "project-barriers"
    },
    "pro-pit-barriers-project-activity-description": {
      property: "barriers_project_activity_description",
      label: "Barriers to Project Activities Descriptions",
      inputType: "text"
    },
    "pro-pit-other-engage-women-youth": {
      property: "other_engage_women_youth",
      label: "Other Ways Project will Engage and Benefit Women/Youth",
      inputType: "text"
    },
    "pro-pit-forest-fragments-distance": {
      property: "forest_fragments_distance",
      label: "Approximate distance in meters between project area and the center of the nearest forest fragment",
      inputType: "number"
    },
    "pro-pit-anr-practices-proposed": {
      property: "anr_practices_proposed",
      label: "ANR practices that the organization will use during the project",
      inputType: "select",
      multiChoice: true,
      optionListKey: "anr-practices"
    },
    "pro-pit-information-authorization": {
      property: "information_authorization",
      label: "If the organization authorizes WRI to use their data for research",
      inputType: "boolean"
    },
    "pro-pit-full-time-jobs-count": {
      property: "full_time_jobs_aggregate",
      label: "Aggregate full time jobs",
      inputType: "number"
    },
    "pro-pit-full-time-clt-jobs-count": {
      property: "full_time_clt_jobs_aggregate",
      label: "Aggregate full time CLT jobs",
      inputType: "number"
    },
    "pro-pit-part-time-jobs-count": {
      property: "part_time_jobs_aggregate",
      label: "Aggregate part time jobs",
      inputType: "number"
    },
    "pro-pit-part-time-clt-jobs-count": {
      property: "part_time_clt_jobs_aggregate",
      label: "Aggregate part time CLT jobs",
      inputType: "number"
    },
    "pro-pit-volunteers-count": {
      property: "volunteers_aggregate",
      label: "Aggregate volunteers",
      inputType: "number"
    },
    "pro-pit-beneficiaries-count": {
      property: "all_beneficiaries_aggregate",
      label: "Aggregate beneficiaries",
      inputType: "number"
    },
    "pro-pit-indirect-beneficiaries-count": {
      property: "indirect_beneficiaries_aggregate",
      label: "Aggregate indirect beneficiaries",
      inputType: "number"
    },
    "pro-pit-associates-count": {
      property: "all_associates_aggregate",
      label: "Aggregate associates",
      inputType: "number"
    },
    "pro-pit-goal-trees-restored-description": {
      property: "goal_trees_restored_description",
      label: "How did you calculate the estimated number of trees planted-restored?",
      inputType: "long-text"
    },
    "pro-pit-jobs-created-beneficiaries-description": {
      property: "jobs_created_beneficiaries_description",
      label:
        "How did you arrive at the provided estimate of number of jobs created, direct and indirect beneficiaries?",
      inputType: "long-text"
    }
  },
  fileCollections: {
    "pro-pit-fcol-cover": { property: "cover", label: "Cover Image", inputType: "file", multiChoice: false },
    "pro-pit-fcol-add": { property: "additional", label: "Additional documents", inputType: "file", multiChoice: true },
    "pro-pit-fcol-rest-photos": {
      property: "restoration_photos",
      label: "Past Restoration Photos",
      inputType: "file",
      multiChoice: true
    },
    "pro-pit-fcol-detail-proj-bdgt": {
      property: "detailed_project_budget",
      label: "Detailed project budget",
      inputType: "file",
      multiChoice: false
    },
    "pro-pit-proof-of-land-tenure-mou": {
      property: "proof_of_land_tenure_mou",
      label: "Proof of land tenure MOU",
      inputType: "file",
      multiChoice: true
    }
  },
  relations: {
    "pro-pit-tree-species": {
      property: "treeSpecies",
      label: "Tree Species",
      resource: "App\\Http\\Resources\\V2\\TreeSpecies\\TreeSpeciesResource",
      inputType: "treeSpecies",
      collection: "tree-planted"
    },
    "pro-pit-all-jobs": {
      property: "jobsAll",
      label: "All Jobs",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "jobs",
      collection: "all"
    },
    "pro-pit-full-time-jobs": {
      property: "jobsFullTime",
      label: "Full-time Jobs",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "jobs",
      collection: "full-time"
    },
    "pro-pit-part-time-jobs": {
      property: "jobsPartTime",
      label: "Part-time Jobs",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "jobs",
      collection: "part-time"
    },
    "pro-pit-volunteers": {
      property: "volunteers",
      label: "Volunteers",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "volunteers",
      collection: "volunteer"
    },
    "pro-pit-all-beneficiaries": {
      property: "allBeneficiaries",
      label: "All Beneficiaries",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "allBeneficiaries",
      collection: "all"
    },
    "pro-pit-indirect-beneficiaries": {
      property: "indirectBeneficiaries",
      label: "Indirect Beneficiaries",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "indirectBeneficiaries",
      collection: "indirect"
    }
  }
};
