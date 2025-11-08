import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { Organisation } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const OrganisationConfiguration: LinkedFieldConfiguration = {
  label: "Organisation",
  laravelModelType: Organisation.LARAVEL_TYPE,
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
    "org-hq-st1": { property: "hq_street_1", label: "HQ street 1", inputType: "text" },
    "org-hq-st2": { property: "hq_street_2", label: "HQ street 2", inputType: "text" },
    "org-hq-city": { property: "hq_city", label: "HQ city", inputType: "text" },
    "org-hq-state": { property: "hq_state", label: "HQ state", inputType: "text" },
    "org-hq-zip": { property: "hq_zipcode", label: "HQ zipcode", inputType: "text" },
    "org-hq-country": {
      property: "hq_country",
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
    "org-fdg-dte": { property: "founding_date", label: "Founding date", inputType: "date" },
    "org-web-url": { property: "web_url", label: "Web url", inputType: "text" },
    "org-fb-url": { property: "facebook_url", label: "Facebook url", inputType: "text" },
    "org-inst-url": { property: "instagram_url", label: "Instagram url", inputType: "text" },
    "org-lnkn-url": { property: "linkedin_url", label: "Linkedin url", inputType: "text" },
    "org-twi-url": { property: "twitter_url", label: "Twitter url", inputType: "text" },
    "org-description": { property: "description", label: "Description", inputType: "long-text" },
    "org-ldr-shp-team": { property: "leadership_team_txt", label: "Leadership Team Text", inputType: "long-text" },
    "org-business-model": { property: "business_model", label: "Business Model", inputType: "long-text" },
    "org-rel-exp-years": {
      property: "relevant_experience_years",
      label: "Relevant experience years",
      inputType: "number"
    },
    "org-ha-res-tot": { property: "ha_restored_total", label: "Ha restored total", inputType: "number" },
    "org-ha-res-3yr": { property: "ha_restored_3year", label: "Ha restored -3 year", inputType: "number" },
    "org-tre-gro-tot": { property: "trees_grown_total", label: "Trees grown total", inputType: "number" },
    "org-tre-gro-3yr": { property: "trees_grown_3year", label: "Trees grown -3 year", inputType: "number" },
    "org-fin_start_month": {
      property: "fin_start_month",
      label: "Start of financial year (month)",
      inputType: "select",
      multiChoice: false,
      optionListKey: "months"
    },
    "org-fin-bgt-cur-year": { property: "fin_budget_current_year", label: "Budget current year", inputType: "number" },
    "org-fin-bgt-1year": { property: "fin_budget_1year", label: "Budget -1 year", inputType: "number" },
    "org-fin-bgt-2year": { property: "fin_budget_2year", label: "Budget -2 year", inputType: "number" },
    "org-fin-bgt-3year": { property: "fin_budget_3year", label: "Budget -3 year", inputType: "number" },
    "org-eng-farmers": {
      property: "engagement_farmers",
      label: "Engagement farmers",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-farmers"
    },
    "org-eng-women": {
      property: "engagement_women",
      label: "Engagement women",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-women"
    },
    "org-eng-youth": {
      property: "engagement_youth",
      label: "Engagement youth",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-youth"
    },
    "org-eng-non-youth": {
      property: "engagement_non_youth",
      label: "Engagement non-youth",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-non-youth"
    },
    "org-ha-rst-tot": { property: "ha_restored_total", label: "Ha restored Total", inputType: "number" },
    "org-ha-rst-3year": { property: "ha_restored_3year", label: "Ha restored -3 year", inputType: "number" },
    "org-community-experience": {
      property: "community_experience",
      label: "Community engagement experience",
      inputType: "long-text"
    },
    "org-tot-eng-comty-mbrs-3yr": {
      property: "total_engaged_community_members_3yr",
      label: "Total # of community members engaged over the last 3 years",
      inputType: "number"
    },
    "org-total-employees": { property: "total_employees", label: "Total number of employees", inputType: "number" },
    "org-female-employees": { property: "female_employees", label: "Number of female employees", inputType: "number" },
    "org-male-employees": { property: "male_employees", label: "Number of male employees", inputType: "number" },
    "org-young-employees": {
      property: "young_employees",
      label: "Number of employees between and including ages 18 and 35",
      inputType: "number"
    },
    "org-temp-employees": { property: "temp_employees", label: "Number of temporary employees", inputType: "number" },
    "org-ft-perm-employees": {
      property: "ft_permanent_employees",
      label: "Number of full-time permanent employees",
      inputType: "number"
    },
    "org-pt-perm-employees": {
      property: "pt_permanent_employees",
      label: "Number of part-time permanent employees",
      inputType: "number"
    },
    "org-over-35-employees": {
      property: "over_35_employees",
      label: "Number of employees older than 35 years of age",
      inputType: "number"
    },
    "org-additional-comments": {
      property: "additional_comments",
      label: "Additional Comments",
      inputType: "long-text"
    },
    "org-engagement-farmers": {
      property: "engagement_farmers",
      label: "Enagement: Farmers",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-farmers"
    },
    "org-engagement-women": {
      property: "engagement_women",
      label: "Enagement: Women",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-women"
    },
    "org-engagement-youth": {
      property: "engagement_youth",
      label: "Enagement: Youth",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-youth"
    },
    "org-add-fund-details": {
      property: "additional_funding_details",
      label: "Additional funding details",
      inputType: "long-text"
    },
    "org-total-trees-grown": { property: "total_trees_grown", label: "Total trees grown", inputType: "number" },
    "org-avg-tree-survival-rate": {
      property: "avg_tree_survival_rate",
      label: "Average tree survival rate",
      inputType: "number"
    },
    "org-tree-maint-aftercare-aprch": {
      property: "tree_maintenance_aftercare_approach",
      label: "Tree maintenance and aftercare approach",
      inputType: "long-text"
    },
    "org-restored-areas-desc": {
      property: "restored_areas_description",
      label: "Restored areas description",
      inputType: "long-text"
    },
    "org-mon-eval-exp": {
      property: "monitoring_evaluation_experience",
      label: "Monitoring evaluation experience",
      inputType: "long-text"
    },
    "org-pct-engaged-women-3yr": {
      property: "percent_engaged_women_3yr",
      label: "Percent women engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-pct-engaged-men-3yr": {
      property: "percent_engaged_men_3yr",
      label: "Percent men engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-pct-engaged-young-3yr": {
      property: "percent_engaged_under_35_3yr",
      label: "Percent youth engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-pct-engaged-old-3yr": {
      property: "percent_engaged_over_35_3yr",
      label: "Percent non-youth engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-pct-engaged-smallholder-3yr": {
      property: "percent_engaged_smallholder_3yr",
      label: "Percent smallholder engaged (3yr)",
      inputType: "number-percentage"
    },
    "org-rev-this-year": {
      property: "organisation_revenue_this_year",
      label: "Organization revenue for this year",
      inputType: "number"
    },
    "org-restoration-types-implemented": {
      property: "restoration_types_implemented",
      label: "Restoration Intervention Types Implemented",
      multiChoice: true,
      inputType: "select"
    },
    "org-historic-monitoring-geojson": {
      property: "historic_monitoring_geojson",
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
    "org-acc-num-1": { property: "account_number_1", label: "Account Number 1", inputType: "text" },
    "org-acc-num-2": { property: "account_number_2", label: "Account Number 2", inputType: "text" },
    "org-loan-status-amount": { property: "loan_status_amount", label: "Loan Status Amount", inputType: "number" },
    "org-loan-status-types": {
      property: "loan_status_types",
      label: "Loan Status Types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "loan-status"
    },
    "org-marg-com-appr": {
      property: "approach_of_marginalized_communities",
      label: "Approach of Marginalized Communities",
      inputType: "long-text"
    },
    "org-marg-com-eng-num": {
      property: "community_engagement_numbers_marginalized",
      label: "Marginalized Community Engagement Numbers",
      inputType: "long-text"
    },
    "org-land-systems": {
      property: "land_systems",
      label: "Land Systems",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-systems"
    },
    "org-fund-utilisation": {
      property: "fund_utilisation",
      label: "Fund Utilisation",
      inputType: "select",
      multiChoice: true,
      optionListKey: "loan-status"
    },
    "org-tree-restoration-practices": {
      property: "tree_restoration_practices",
      label: "Tree Restoration Practices",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-practices"
    },
    "org-detailed-interventions": {
      property: "detailed_intervention_types",
      label: "Detailed Intervention Types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "interventions"
    },
    "org-com-eng-3yr": {
      property: "community_members_engaged_3yr",
      label: "Community Members Engaged (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-men": {
      property: "community_members_engaged_3yr_men",
      label: "Community Members Engaged - Men (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-women": {
      property: "community_members_engaged_3yr_women",
      label: "Community Members Engaged - Women (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-youth": {
      property: "community_members_engaged_3yr_youth",
      label: "Community Members Engaged - Youth (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-non-youth": {
      property: "community_members_engaged_3yr_non_youth",
      label: "Community Members Engaged - Non-Youth (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-smallholder": {
      property: "community_members_engaged_3yr_smallholder",
      label: "Community Members Engaged - Smallholder (3 years)",
      inputType: "number"
    },
    "org-com-eng-3yr-backward-class": {
      property: "community_members_engaged_3yr_backward_class",
      label: "Community Members Engaged - Backward Class (3 years)",
      inputType: "number"
    },
    "org-field-staff-skills": { property: "field_staff_skills", label: "Field staff skills", inputType: "long-text" },
    "org-fpc-company": {
      property: "fpc_company",
      label: "FPC company",
      inputType: "radio",
      multiChoice: false,
      optionListKey: "yes-no"
    },
    "org-num_of-marginalised-employees": {
      property: "num_of_marginalised_employees",
      label: "Number of employees from Marginalised statuses",
      inputType: "number"
    },
    "org-benefactors-fpc-company": {
      property: "benefactors_fpc_company",
      label: "Supporters/benefactors: FPC company",
      inputType: "long-text"
    },
    "org-board-remuneration-fpc-company": {
      property: "board_remuneration_fpc_company",
      label: "Board remuneration: FPC company",
      inputType: "select",
      multiChoice: false,
      optionListKey: "board-remuneration"
    },
    "org-board-engagement-fpc-company": {
      property: "board_engagement_fpc_company",
      label: "Board engagement: FPC company",
      inputType: "select",
      multiChoice: false,
      optionListKey: "board-engagement"
    },
    "org-biodiversity-focus": {
      property: "biodiversity_focus",
      label: "Biodiversity focus",
      inputType: "select",
      multiChoice: true,
      optionListKey: "biodiversity"
    },
    "org-global-planning-frameworks": {
      property: "global_planning_frameworks",
      label: "Global planning frameworks",
      inputType: "select",
      multiChoice: true,
      optionListKey: "planning-frameworks"
    },
    "org-past-gov-collaboration": {
      property: "past_gov_collaboration",
      label: "Past Government Collaboration",
      inputType: "long-text"
    },
    "org-engagement-landless": {
      property: "engagement_landless",
      label: "Engagement: Landless",
      inputType: "select",
      multiChoice: true,
      optionListKey: "engagement-landless"
    },
    "org-environmental-impact": {
      property: "environmental_impact",
      label: "Environmental Impact",
      inputType: "long-text"
    },
    "org-socioeconomic-impact": {
      property: "socioeconomic_impact",
      label: "Socioeconomic Impact",
      inputType: "long-text"
    },
    "org-growith-stage": {
      property: "growith_stage",
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
      property: "female_youth_leadership_example",
      label: "Female or youth contribution to project leadership or decision making example",
      inputType: "long-text"
    },
    "org-level-0-past-restoration": {
      property: "level_0_past_restoration",
      label: "countries where organisation has previously restored land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-0"
    },
    "org-level-1-past-restoration": {
      property: "level_1_past_restoration",
      label: "GADM level 1 administrative areas where organisation has previously restored land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-1"
    },
    "org-level-2-past-restoration": {
      property: "level_2_past_restoration",
      label: "GADM level 2 administrative areas where organisation has previously restored land",
      inputType: "select",
      multiChoice: true,
      optionListKey: "gadm-level-2"
    },
    "org-trees-naturally-regenerated-total": {
      property: "trees_naturally_regenerated_total",
      label: "Total trees naturally regenerated by organisation since founding",
      inputType: "number"
    },
    "org-trees-naturally-regenerated-3year": {
      property: "trees_naturally_regenerated_3year",
      label: "Total trees naturally regenerated by organisation in last 36 months",
      inputType: "number"
    },
    "org-carbon-credits": {
      property: "carbon_credits",
      label: "Has organisation ever issued carbon credits since founding",
      inputType: "conditional",
      multiChoice: false
    },
    "org-external-technical-assistance": {
      property: "external_technical_assistance",
      label: "Description of Non-Financial Technical Assistance Organisation has Received",
      inputType: "long-text"
    },
    "org-barriers-to-funding": {
      property: "barriers_to_funding",
      label: "Barriers organisation faces to accessing funding, scaling operations, or delivering impact",
      inputType: "long-text"
    },
    "org-capacity-building-support-needed": {
      property: "capacity_building_support_needed",
      label: "Where Support Needed for Project Capacity-Building",
      inputType: "long-text"
    },
    "org-associations-cooperatives": {
      property: "associations_cooperatives",
      label: "Is the organization an association or cooperative?",
      inputType: "boolean"
    },
    "org-territories-of-operation": {
      property: "territories_of_operation",
      label: "Territories in which the organization operates",
      inputType: "select",
      multiChoice: true,
      optionListKey: "territories-of-operation-collection"
    },
    "org-decisionmaking-structure-description": {
      property: "decisionmaking_structure_description",
      label: "Organization’s decision-making structure",
      inputType: "long-text"
    },
    "org-decisionmaking-structure-individuals-involved": {
      property: "decisionmaking_structure_individuals_involved",
      label: "Individuals involved in decision-making structure",
      inputType: "long-text"
    },
    "org-average-worker-income": {
      property: "average_worker_income",
      label: "Average income per worker over the past year",
      inputType: "number"
    },
    "org-anr-practices-past": {
      property: "anr_practices_past",
      label: "ANR practices that the organization has used",
      inputType: "select",
      multiChoice: true,
      optionListKey: "anr-practices-past-collection"
    },
    "org-anr-monitoring-approaches": {
      property: "anr_monitoring_approaches",
      label: "Approaches the organization has used to monitor ANR progress",
      inputType: "select",
      multiChoice: true,
      optionListKey: "anr-monitoring-approaches-collection"
    },
    "org-anr-monitoring-approaches-description": {
      property: "anr_monitoring_approaches_description",
      label: "Description of the approaches used to monitor ANR progress",
      inputType: "text"
    },
    "org-anr-communication-funders": {
      property: "anr_communication_funders",
      label: "How the organization communicated ANR impact to funders",
      inputType: "text"
    },
    "org-bioeconomy-products": {
      property: "bioeconomy_products",
      label: "Bioeconomy products cultivated by organization",
      inputType: "text"
    },
    "org-bioeconomy-traditional-knowledge": {
      property: "bioeconomy_traditional_knowledge",
      label: "Traditional Knowledge within the bioeconomy production process",
      inputType: "long-text"
    },
    "org-bioeconomy-product-processing": {
      property: "bioeconomy_product_processing",
      label: "How bioeconomy products are processed before selling",
      inputType: "long-text"
    },
    "org-bioeconomy-buyers": {
      property: "bioeconomy_buyers",
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
      property: "fundingTypes",
      label: "Funding Type",
      resource: "fundingTypes",
      inputType: "fundingType"
    },
    "org-tree-species": {
      property: "treeSpeciesHistorical",
      label: "Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "historical-tree-species"
    },
    "org-tree-species-restored": {
      property: "treeSpeciesHistorical",
      label: "Tree species restored in landscape",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "historical-tree-species"
    },
    "org-ownership-stake": {
      property: "ownershipStake",
      label: "Ownership Stake",
      resource: "ownershipStake",
      inputType: "ownershipStake"
    },
    "org-beneficiaries-all": {
      property: "allBeneficiaries",
      label: "Community Members",
      resource: "demographics",
      inputType: "allBeneficiaries",
      collection: "all"
    },
    "org-employees-full-time": {
      property: "employeesFullTime",
      label: "Full Time Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "full-time"
    },
    "org-employees-full-time-clt": {
      property: "employeesFullTimeClt",
      label: "Full Time CLT Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "full-time-clt"
    },
    "org-leadership-team": {
      property: "leadershipTeam",
      label: "Leadership Team",
      resource: "leaderships",
      inputType: "leaderships",
      collection: "leadership-team"
    },
    "org-core-team-leaders": {
      property: "coreTeamLeaders",
      label: "Core Team Leaders",
      resource: "leaderships",
      inputType: "leaderships",
      collection: "core-team-leaders"
    },
    "org-employees-part-time": {
      property: "employeesPartTime",
      label: "Part Time Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "part-time"
    },
    "org-employees-part-time-clt": {
      property: "employeesPartTimeClt",
      label: "Part Time CLT Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "part-time-clt"
    },
    "org-employees-temp": {
      property: "employeesTemp",
      label: "Temp Employees",
      resource: "demographics",
      inputType: "employees",
      collection: "temp"
    },
    "org-associates": {
      property: "associates",
      label: "Associates",
      resource: "demographics",
      inputType: "associates",
      collection: "all"
    },
    "org-financial-indicators-financial-collection": {
      property: "financialCollection",
      label: "Financial collection",
      resource: "financialIndicators",
      inputType: "financialIndicators"
    }
  }
};
