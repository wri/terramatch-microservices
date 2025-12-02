import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { ProjectReport } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const ProjectReportConfiguration: LinkedFieldConfiguration<ProjectReport> = {
  label: "Project Report",
  fields: {
    "pro-rep-title": { property: "title", label: "Title", inputType: "text" },
    "pro-rep-workdays-paid": { property: "workdays_paid", label: "Workdays Paid", inputType: "number" },
    "pro-rep-workdays-volunteer": { property: "workdays_volunteer", label: "Workdays Volunteer", inputType: "number" },
    "pro-rep-tech-nar": { property: "technicalNarrative", label: "Technical narrative", inputType: "long-text" },
    "pro-rep-pub-nar": { property: "publicNarrative", label: "Public narrative", inputType: "long-text" },
    "pro-rep-landscape-com-con": {
      property: "landscapeCommunityContribution",
      label: "Landscape Progress",
      inputType: "long-text"
    },
    "pro-rep-top-three-successes": {
      property: "topThreeSuccesses",
      label: "Top Three Successes",
      inputType: "long-text"
    },
    "pro-rep-chal-faced": { property: "challengesFaced", label: "Challenges Faced", inputType: "long-text" },
    "pro-rep-lessons": { property: "lessonsLearned", label: "Lessons Learned", inputType: "long-text" },
    "pro-rep-maint-mon-act": {
      property: "maintenanceAndMonitoringActivities",
      label: "Maintenance and Monitoring Activities",
      inputType: "long-text"
    },
    "pro-rep-sig-change": { property: "significantChange", label: "Significant Change", inputType: "long-text" },
    "pro-rep-pct-surv": {
      property: "pctSurvivalToDate",
      label: "Percentage Survival to Date",
      inputType: "number-percentage"
    },
    "pro-rep-surv-calc": { property: "survivalCalculation", label: "Survival Calculation", inputType: "long-text" },
    "pro-rep-surv-comp": { property: "survivalComparison", label: "Survival Comparison", inputType: "long-text" },
    "pro-rep-ft-women": { property: "ftWomen", label: "FT Women", inputType: "number" },
    "pro-rep-ft-men": { property: "ftMen", label: "FT Men", inputType: "number" },
    "pro-rep-ft-youth": { property: "ftYouth", label: "FT Youth", inputType: "number" },
    "pro-rep-ft-smallholder": { property: "ftSmallholderFarmers", label: "FT Smallholder", inputType: "number" },
    "pro-rep-ft-total": { property: "ftTotal", label: "FT Total", inputType: "number" },
    "pro-rep-pt-women": { property: "ptWomen", label: "PT Women", inputType: "number" },
    "pro-rep-pt-men": { property: "ptMen", label: "PT Men", inputType: "number" },
    "pro-rep-pt-youth": { property: "ptYouth", label: "PT Youth", inputType: "number" },
    "pro-rep-pt-non-youth": { property: "ptNonYouth", label: "PT Non-Youth", inputType: "number" },
    "pro-rep-pt-smallholder": { property: "ptSmallholderFarmers", label: "PT Smallholder", inputType: "number" },
    "pro-rep-pt-total": { property: "ptTotal", label: "PT Total", inputType: "number" },
    "pro-rep-seasonal-women": { property: "seasonalWomen", label: "Seasonal Women", inputType: "number" },
    "pro-rep-seasonal-men": { property: "seasonalMen", label: "Seasonal Men", inputType: "number" },
    "pro-rep-seasonal-youth": { property: "seasonalYouth", label: "Seasonal Youth", inputType: "number" },
    "pro-rep-seasonal-smallholder": {
      property: "seasonalSmallholderFarmers",
      label: "Seasonal Smallholder",
      inputType: "number"
    },
    "pro-rep-seasonal-total": { property: "seasonalTotal", label: "Seasonal Total", inputType: "number" },
    "pro-rep-volunteer-women": { property: "volunteerWomen", label: "Volunteer Women", inputType: "number" },
    "pro-rep-volunteer-men": { property: "volunteerMen", label: "Volunteer Men", inputType: "number" },
    "pro-rep-volunteer-youth": { property: "volunteerYouth", label: "Volunteer Youth", inputType: "number" },
    "pro-rep-volunteer-smallholder": {
      property: "volunteerSmallholderFarmers",
      label: "Volunteer Smallholder",
      inputType: "number"
    },
    "pro-rep-volunteer-total": { property: "volunteerTotal", label: "Volunteer Total", inputType: "number" },
    "pro-rep-shared-drive": { property: "sharedDriveLink", label: "Shared Drive Link", inputType: "url" },
    "pro-rep-planted-trees": { property: "plantedTrees", label: "Planted Trees", inputType: "number" },
    "pro-rep-new-jobs-desc": {
      property: "newJobsDescription",
      label: "New Jobs Description",
      inputType: "long-text"
    },
    "pro-rep-volunteer-desc": {
      property: "volunteersWorkDescription",
      label: "Volunteers Work Description",
      inputType: "long-text"
    },
    "pro-rep-ft-non-youth": { property: "ftJobsNonYouth", label: "FT Jobs Non-Youth", inputType: "number" },
    "pro-rep-volunteer-non-youth": {
      property: "volunteerNonYouth",
      label: "Volunteer Non-Youth",
      inputType: "number"
    },
    "pro-rep-beneficiaries": { property: "beneficiaries", label: "Beneficiaries", inputType: "number" },
    "pro-rep-beneficiaries-desc": {
      property: "beneficiariesDescription",
      label: "Beneficiaries Description",
      inputType: "long-text"
    },
    "pro-rep-beneficiaries-women": {
      property: "beneficiariesWomen",
      label: "Beneficiaries Women",
      inputType: "number"
    },
    "pro-rep-beneficiaries-men": { property: "beneficiariesMen", label: "Beneficiaries Men", inputType: "number" },
    "pro-rep-beneficiaries-non-youth": {
      property: "beneficiariesNonYouth",
      label: "Beneficiaries Non-Youth",
      inputType: "number"
    },
    "pro-rep-beneficiaries-youth": {
      property: "beneficiariesYouth",
      label: "Beneficiaries Youth",
      inputType: "number"
    },
    "pro-rep-beneficiaries-smallholder": {
      property: "beneficiariesSmallholder",
      label: "Beneficiaries Smallholder",
      inputType: "number"
    },
    "pro-rep-beneficiaries-large-scl": {
      property: "beneficiariesLargeScale",
      label: "Beneficiaries Large Scale",
      inputType: "number"
    },
    "pro-rep-beneficiaries-income-inc": {
      property: "beneficiariesIncomeIncrease",
      label: "Beneficiaries Income Increase",
      inputType: "number"
    },
    "pro-rep-beneficiaries-income-desc": {
      property: "beneficiariesIncomeIncreaseDescription",
      label: "Beneficiaries Income Increase Description",
      inputType: "long-text"
    },
    "pro-rep-beneficiaries-skill-inc": {
      property: "beneficiariesSkillsKnowledgeIncrease",
      label: "Beneficiaries Skills Knowledge Increased",
      inputType: "number"
    },
    "pro-rep-beneficiaries-skill-inc-desc": {
      property: "beneficiariesSkillsKnowledgeIncreaseDescription",
      label: "Beneficiaries Skills Knowledge Description",
      inputType: "long-text"
    },
    "pro-rep-people_knowledge-skills-increased": {
      property: "peopleKnowledgeSkillsIncreased",
      label: "People Knowledge Skills Increased",
      inputType: "number"
    },
    "pro-rep-community-progress": {
      property: "communityProgress",
      label: "Community Engagement Progress",
      inputType: "long-text"
    },
    "pro-rep-equitable-opportunities": {
      property: "equitableOpportunities",
      label: "Equitable Opportunities for Women + Youth",
      inputType: "long-text"
    },
    "pro-rep-local-engagement": {
      property: "localEngagement",
      label: "Community Engagement Approach",
      inputType: "select",
      multiChoice: false,
      optionListKey: "local-engagement"
    },
    "pro-rep-planting-status": {
      property: "plantingStatus",
      label: "Planting status",
      inputType: "select",
      multiChoice: false,
      optionListKey: "planting-status"
    },
    "pro-rep-site-addition": { property: "siteAddition", label: "Site Addition", inputType: "boolean" },
    "pro-rep-resilience_progress": {
      property: "resilienceProgress",
      label: "Climate Resilience Progress",
      inputType: "long-text"
    },
    "pro-rep-local_governance": { property: "localGovernance", label: "Governance Progress", inputType: "long-text" },
    "pro-rep-adaptive_management": {
      property: "adaptiveManagement",
      label: "Adaptative Management",
      inputType: "long-text"
    },
    "pro-rep-scalability_replicability": {
      property: "scalabilityReplicability",
      label: "Scalability Progress",
      inputType: "long-text"
    },
    "pro-rep-convergence_jobs_description": {
      property: "convergenceJobsDescription",
      label: "Description of Convergence Jobs",
      inputType: "long-text"
    },
    "pro-rep-convergence_schemes": {
      property: "convergenceSchemes",
      label: "Convergence Schemes",
      inputType: "long-text"
    },
    "pro-rep-convergence_amount": { property: "convergenceAmount", label: "Convergence Raised", inputType: "number" },
    "pro-rep-community_partners_assets_description": {
      property: "communityPartnersAssetsDescription",
      label: "Community Assests",
      inputType: "long-text"
    },
    "pro-rep-volunteer_scstobc": {
      property: "volunteerScstobc",
      label: "Volunteers Marginalized",
      inputType: "number"
    },
    "pro-rep-beneficiaries_scstobc_farmers": {
      property: "beneficiariesScstobcFarmers",
      label: "Community Partners Marginalized Farmers",
      inputType: "number"
    },
    "pro-rep-beneficiaries_scstobc": {
      property: "beneficiariesScstobc",
      label: "Community Partners Marginalized",
      inputType: "number"
    },
    // TODO (TM-912) Deprecated, to be removed.
    "pro-rep-paid-other-activity-description": {
      property: "paidOtherActivityDescription",
      label: "Paid Other Activities Description",
      inputType: "long-text"
    },
    "pro-rep-other-workdays-description": {
      property: "other_workdays_description",
      label: "Other Activities Description",
      inputType: "long-text"
    },
    "pro-rep-local-engagement-description": {
      property: "localEngagementDescription",
      label: "Response to Local Priorities",
      inputType: "long-text"
    },
    "pro-rep-indirect-beneficiaries": {
      property: "indirectBeneficiaries",
      label: "Number of Indirect Beneficiaries",
      inputType: "number"
    },
    "pro-rep-indirect-beneficiaries-description": {
      property: "indirectBeneficiariesDescription",
      label: "Indirect Beneficiaries Description",
      inputType: "long-text"
    },
    "pro-rep-other-restoration-partners-description": {
      property: "other_restoration_partners_description",
      label: "Other Restoration Partners Description",
      inputType: "long-text"
    },
    "pro-rep-total-unique-restoration-partners": {
      property: "totalUniqueRestorationPartners",
      label: "Total Unique Restoration Partners",
      inputType: "number"
    },
    "pro-rep-business-milestones": {
      property: "businessMilestones",
      label: "Business Milestones",
      inputType: "long-text"
    },
    "pro-rep-ft-other": { property: "ftOther", label: "Full Time Other Gender", inputType: "number" },
    "pro-rep-pt-other": { property: "ptOther", label: "Part Time Other Gender", inputType: "number" },
    "pro-rep-volunteer_other": { property: "volunteerOther", label: "Volunteer Other Gender", inputType: "number" },
    "pro-rep-beneficiaries-other": {
      property: "beneficiariesOther",
      label: "Other Gender Beneficiary",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-women": {
      property: "beneficiariesTrainingWomen",
      label: "Women Trained",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-men": {
      property: "beneficiariesTrainingMen",
      label: "Men Trained",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-other": {
      property: "beneficiariesTrainingOther",
      label: "Other Gender Trained",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-youth": {
      property: "beneficiariesTrainingYouth",
      label: "Youth Trained",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-non-youth": {
      property: "beneficiariesTrainingNonYouth",
      label: "Non Youth Trained",
      inputType: "number"
    }
  },
  fileCollections: {
    "pro-rep-col-media": { collection: "media", label: "Media", inputType: "file", multiChoice: true },
    "pro-rep-col-socioeconomic-benefits": {
      collection: "socioeconomic_benefits",
      label: "Socioeconomic benefits",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-file": { collection: "file", label: "File", inputType: "file", multiChoice: true },
    "pro-rep-col-other-additional-documents": {
      collection: "other_additional_documents",
      label: "Other additional documents",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-photos": { collection: "photos", label: "Photos", inputType: "file", multiChoice: true },
    "pro-rep-col-baseline-report-upload": {
      collection: "baseline_report_upload",
      label: "Baseline Report Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-local-governance-order-letter-upload": {
      collection: "local_governance_order_letter_upload",
      label: "Local Governance Order or Letter Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-events-meetings-photos": {
      collection: "events_meetings_photos",
      label: "Events or Meetings Photos",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-local-governance-proof-of-partnership-upload": {
      collection: "local_governance_proof_of_partnership_upload",
      label: "Local Governance Proof of Partnership Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-top-three-successes-upload": {
      collection: "top_three_successes_upload",
      label: "Top Three Successes Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-direct-jobs-upload": {
      collection: "direct_jobs_upload",
      label: "Direct Jobs Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-convergence-jobs-upload": {
      collection: "convergence_jobs_upload",
      label: "Convergence Jobs Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-convergence-schemes-upload": {
      collection: "convergence_schemes_upload",
      label: "Convergence Schemes Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-livelihood-activities-upload": {
      collection: "livelihood_activities_upload",
      label: "Livelihood Report Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-direct-livelihood-impacts-upload": {
      collection: "direct_livelihood_impacts_upload",
      label: "Direct Livelihood Impacts Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-certified-database-upload": {
      collection: "certified_database_upload",
      label: "Certified Database Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-physical-assets-photos": {
      collection: "physical_assets_photos",
      label: "Physical Assets Photos",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-indirect-community-partners-upload": {
      collection: "indirect_community_partners_upload",
      label: "Indirect Community Partners Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-training-capacity-building-upload": {
      collection: "training_capacity_building_upload",
      label: "Training or Capacity Building Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-training-capacity-building-photos": {
      collection: "training_capacity_building_photos",
      label: "Training or Capacity Building Photos",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-financial-report-upload": {
      collection: "financial_report_upload",
      label: "Financial Report Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-tree-planting-upload": {
      collection: "tree_planting_upload",
      label: "Tree Planting Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-soil-water-conservation-upload": {
      collection: "soil_water_conservation_upload",
      label: "Soil or Water Conservation Upload",
      inputType: "file",
      multiChoice: true
    },
    "pro-rep-col-soil-water-conservation-photos": {
      collection: "soil_water_conservation_photos",
      label: "Soil or Water Conservation Photos",
      inputType: "file",
      multiChoice: true
    }
  },
  relations: {
    "pro-rep-rel-tree-species": {
      label: "Tree Species (Nursery Seedling)",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "nursery-seedling"
    },
    "pro-rep-rel-paid-nursery-operations": {
      label: "Paid Nursery Operations",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-nursery-operations"
    },
    "pro-rep-rel-paid-project-management": {
      label: "Paid Project Management",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-project-management"
    },
    "pro-rep-rel-paid-other-activities": {
      label: "Paid Other Activities",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-other-activities"
    },
    "pro-rep-rel-volunteer-nursery-operations": {
      label: "Volunteer Nursery Operations",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-nursery-operations"
    },
    "pro-rep-rel-volunteer-project-management": {
      label: "Volunteer Project Management",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-project-management"
    },
    "pro-rep-rel-volunteer-other-activities": {
      label: "Volunteer Other Activities",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-other-activities"
    },
    "pro-rep-direct-workdays": {
      label: "Direct Workday",
      resource: "demographics",
      inputType: "workdays",
      collection: "direct"
    },
    "pro-rep-convergence-workdays": {
      label: "Convergence Workday",
      resource: "demographics",
      inputType: "workdays",
      collection: "convergence"
    },
    "pro-rep-direct-income-partners": {
      label: "Direct Income Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-income"
    },
    "pro-rep-indirect-income-partners": {
      label: "Indirect Income Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-income"
    },
    "pro-rep-direct-benefits-partners": {
      label: "Direct In-kind Benefits Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-benefits"
    },
    "pro-rep-indirect-benefits-partners": {
      label: "Indirect In-kind Benefits Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-benefits"
    },
    "pro-rep-direct-conservation-payments-partners": {
      label: "Direct Conservation Agreement Payment Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-conservation-payments"
    },
    "pro-rep-indirect-conservation-payments-partners": {
      label: "Indirect Conservation Agreement Payment Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-conservation-payments"
    },
    "pro-rep-direct-market-access-partners": {
      label: "Direct Increased Market Access Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-market-access"
    },
    "pro-rep-indirect-market-access-partners": {
      label: "Indirect Increased Market Access Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-market-access"
    },
    "pro-rep-direct-capacity-partners": {
      label: "Direct Increased Capacity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-capacity"
    },
    "pro-rep-indirect-capacity-partners": {
      label: "Indirect Capacity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-capacity"
    },
    "pro-rep-direct-training-partners": {
      label: "Direct Training Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-training"
    },
    "pro-rep-indirect-training-partners": {
      label: "Indirect Training Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-training"
    },
    "pro-rep-direct-land-title-partners": {
      label: "Direct Newly Secured Land Title Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-land-title"
    },
    "pro-rep-indirect-land-title-partners": {
      label: "Indirect Newly Secured Land Title Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-land-title"
    },
    "pro-rep-direct-livelihoods-partners": {
      label: "Direct Traditional Livelihoods or Customer Rights Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-livelihoods"
    },
    "pro-rep-indirect-livelihoods-partners": {
      label: "Indirect Traditional Livelihoods or Customer Rights Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-livelihoods"
    },
    "pro-rep-direct-productivity-partners": {
      label: "Direct Increased Productivity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-productivity"
    },
    "pro-rep-indirect-productivity-partners": {
      label: "Indirect Increased Productivity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-productivity"
    },
    "pro-rep-direct-other-partners": {
      label: "Direct Other Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-other"
    },
    "pro-rep-indirect-other-partners": {
      label: "Indirect Other Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-other"
    },
    "pro-rep-full-time-jobs": {
      label: "Full-time Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "full-time"
    },
    "pro-rep-full-time-clt-jobs": {
      label: "Full-time CLT Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "full-time-clt"
    },
    "pro-rep-part-time-jobs": {
      label: "Part-time Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "part-time"
    },
    "pro-rep-part-time-clt-jobs": {
      label: "Part-time CLT Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "part-time-clt"
    },
    "pro-rep-volunteers": {
      label: "Volunteers",
      resource: "demographics",
      inputType: "volunteers",
      collection: "volunteer"
    },
    "pro-rep-beneficiaries-all": {
      label: "All Beneficiaries",
      resource: "demographics",
      inputType: "allBeneficiaries",
      collection: "all"
    },
    "pro-rep-beneficiaries-training": {
      label: "Training Beneficiaries",
      resource: "demographics",
      inputType: "trainingBeneficiaries",
      collection: "training"
    },
    "pro-rep-associates": {
      label: "Associates",
      resource: "demographics",
      inputType: "associates",
      collection: "all"
    }
  }
};
