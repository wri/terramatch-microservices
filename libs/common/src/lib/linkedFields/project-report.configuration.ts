import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { ProjectReport } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const ProjectReportConfiguration: LinkedFieldConfiguration = {
  label: "Project Report",
  laravelModelType: ProjectReport.LARAVEL_TYPE,
  fields: {
    "pro-rep-title": { property: "title", label: "Title", inputType: "text" },
    "pro-rep-ind-1": { property: "ethnic_indigenous_1", label: "Indigenous 1", inputType: "number" },
    "pro-rep-ind-2": { property: "ethnic_indigenous_2", label: "Indigenous 2", inputType: "number" },
    "pro-rep-ind-3": { property: "ethnic_indigenous_3", label: "Indigenous 3", inputType: "number" },
    "pro-rep-ind-4": { property: "ethnic_indigenous_4", label: "Indigenous 4", inputType: "number" },
    "pro-rep-ind-5": { property: "ethnic_indigenous_5", label: "Indigenous 5", inputType: "number" },
    "pro-rep-other-1": { property: "ethnic_other_1", label: "Other 1", inputType: "number" },
    "pro-rep-other-2": { property: "ethnic_other_2", label: "Other 2", inputType: "number" },
    "pro-rep-other-3": { property: "ethnic_other_3", label: "Other 3", inputType: "number" },
    "pro-rep-other-4": { property: "ethnic_other_4", label: "Other 4", inputType: "number" },
    "pro-rep-other-5": { property: "ethnic_other_5", label: "Other 5", inputType: "number" },
    "pro-rep-workdays-paid": { property: "workdays_paid", label: "Workdays Paid", inputType: "number" },
    "pro-rep-workdays-volunteer": { property: "workdays_volunteer", label: "Workdays Volunteer", inputType: "number" },
    "pro-rep-tech-nar": { property: "technical_narrative", label: "Technical narrative", inputType: "long-text" },
    "pro-rep-pub-nar": { property: "public_narrative", label: "Public narrative", inputType: "long-text" },
    "pro-rep-landscape-com-con": {
      property: "landscape_community_contribution",
      label: "Landscape Progress",
      inputType: "long-text"
    },
    "pro-rep-top-three-successes": {
      property: "top_three_successes",
      label: "Top Three Successes",
      inputType: "long-text"
    },
    "pro-rep-chal-faced": { property: "challenges_faced", label: "Challenges Faced", inputType: "long-text" },
    "pro-rep-lessons": { property: "lessons_learned", label: "Lessons Learned", inputType: "long-text" },
    "pro-rep-maint-mon-act": {
      property: "maintenance_and_monitoring_activities",
      label: "Maintenance and Monitoring Activities",
      inputType: "long-text"
    },
    "pro-rep-sig-change": { property: "significant_change", label: "Significant Change", inputType: "long-text" },
    "pro-rep-pct-surv": {
      property: "pct_survival_to_date",
      label: "Percentage Survival to Date",
      inputType: "number-percentage"
    },
    "pro-rep-surv-calc": { property: "survival_calculation", label: "Survival Calculation", inputType: "long-text" },
    "pro-rep-surv-comp": { property: "survival_comparison", label: "Survival Comparison", inputType: "long-text" },
    "pro-rep-ft-women": { property: "ft_women", label: "FT Women", inputType: "number" },
    "pro-rep-ft-men": { property: "ft_men", label: "FT Men", inputType: "number" },
    "pro-rep-ft-youth": { property: "ft_youth", label: "FT Youth", inputType: "number" },
    "pro-rep-ft-smallholder": { property: "ft_smallholder_farmers", label: "FT Smallholder", inputType: "number" },
    "pro-rep-ft-total": { property: "ft_total", label: "FT Total", inputType: "number" },
    "pro-rep-pt-women": { property: "pt_women", label: "PT Women", inputType: "number" },
    "pro-rep-pt-men": { property: "pt_men", label: "PT Men", inputType: "number" },
    "pro-rep-pt-youth": { property: "pt_youth", label: "PT Youth", inputType: "number" },
    "pro-rep-pt-non-youth": { property: "pt_non_youth", label: "PT Non-Youth", inputType: "number" },
    "pro-rep-pt-smallholder": { property: "pt_smallholder_farmers", label: "PT Smallholder", inputType: "number" },
    "pro-rep-pt-total": { property: "pt_total", label: "PT Total", inputType: "number" },
    "pro-rep-seasonal-women": { property: "seasonal_women", label: "Seasonal Women", inputType: "number" },
    "pro-rep-seasonal-men": { property: "seasonal_men", label: "Seasonal Men", inputType: "number" },
    "pro-rep-seasonal-youth": { property: "seasonal_youth", label: "Seasonal Youth", inputType: "number" },
    "pro-rep-seasonal-smallholder": {
      property: "seasonal_smallholder_farmers",
      label: "Seasonal Smallholder",
      inputType: "number"
    },
    "pro-rep-seasonal-total": { property: "seasonal_total", label: "Seasonal Total", inputType: "number" },
    "pro-rep-volunteer-women": { property: "volunteer_women", label: "Volunteer Women", inputType: "number" },
    "pro-rep-volunteer-men": { property: "volunteer_men", label: "Volunteer Men", inputType: "number" },
    "pro-rep-volunteer-youth": { property: "volunteer_youth", label: "Volunteer Youth", inputType: "number" },
    "pro-rep-volunteer-smallholder": {
      property: "volunteer_smallholder_farmers",
      label: "Volunteer Smallholder",
      inputType: "number"
    },
    "pro-rep-volunteer-total": { property: "volunteer_total", label: "Volunteer Total", inputType: "number" },
    "pro-rep-shared-drive": { property: "shared_drive_link", label: "Shared Drive Link", inputType: "url" },
    "pro-rep-planted-trees": { property: "planted_trees", label: "Planted Trees", inputType: "number" },
    "pro-rep-new-jobs-desc": {
      property: "new_jobs_description",
      label: "New Jobs Description",
      inputType: "long-text"
    },
    "pro-rep-volunteer-desc": {
      property: "volunteers_work_description",
      label: "Volunteers Work Description",
      inputType: "long-text"
    },
    "pro-rep-ft-non-youth": { property: "ft_jobs_non_youth", label: "FT Jobs Non-Youth", inputType: "number" },
    "pro-rep-volunteer-non-youth": {
      property: "volunteer_non_youth",
      label: "Volunteer Non-Youth",
      inputType: "number"
    },
    "pro-rep-beneficiaries": { property: "beneficiaries", label: "Beneficiaries", inputType: "number" },
    "pro-rep-beneficiaries-desc": {
      property: "beneficiaries_description",
      label: "Beneficiaries Description",
      inputType: "long-text"
    },
    "pro-rep-beneficiaries-women": {
      property: "beneficiaries_women",
      label: "Beneficiaries Women",
      inputType: "number"
    },
    "pro-rep-beneficiaries-men": { property: "beneficiaries_men", label: "Beneficiaries Men", inputType: "number" },
    "pro-rep-beneficiaries-non-youth": {
      property: "beneficiaries_non_youth",
      label: "Beneficiaries Non-Youth",
      inputType: "number"
    },
    "pro-rep-beneficiaries-youth": {
      property: "beneficiaries_youth",
      label: "Beneficiaries Youth",
      inputType: "number"
    },
    "pro-rep-beneficiaries-smallholder": {
      property: "beneficiaries_smallholder",
      label: "Beneficiaries Smallholder",
      inputType: "number"
    },
    "pro-rep-beneficiaries-large-scl": {
      property: "beneficiaries_large_scale",
      label: "Beneficiaries Large Scale",
      inputType: "number"
    },
    "pro-rep-beneficiaries-income-inc": {
      property: "beneficiaries_income_increase",
      label: "Beneficiaries Income Increase",
      inputType: "number"
    },
    "pro-rep-beneficiaries-income-desc": {
      property: "beneficiaries_income_increase_description",
      label: "Beneficiaries Income Increase Description",
      inputType: "long-text"
    },
    "pro-rep-beneficiaries-skill-inc": {
      property: "beneficiaries_skills_knowledge_increase",
      label: "Beneficiaries Skills Knowledge Increased",
      inputType: "number"
    },
    "pro-rep-beneficiaries-skill-inc-desc": {
      property: "beneficiaries_skills_knowledge_increase_description",
      label: "Beneficiaries Skills Knowledge Description",
      inputType: "long-text"
    },
    "pro-rep-people_knowledge-skills-increased": {
      property: "people_knowledge_skills_increased",
      label: "People Knowledge Skills Increased",
      inputType: "number"
    },
    "pro-rep-community-progress": {
      property: "community_progress",
      label: "Community Engagement Progress",
      inputType: "long-text"
    },
    "pro-rep-equitable-opportunities": {
      property: "equitable_opportunities",
      label: "Equitable Opportunities for Women + Youth",
      inputType: "long-text"
    },
    "pro-rep-local-engagement": {
      property: "local_engagement",
      label: "Community Engagement Approach",
      inputType: "select",
      multiChoice: false,
      optionListKey: "local-engagement"
    },
    "pro-rep-planting-status": {
      property: "planting_status",
      label: "Planting status",
      inputType: "select",
      multiChoice: false,
      optionListKey: "planting-status"
    },
    "pro-rep-site-addition": { property: "site_addition", label: "Site Addition", inputType: "boolean" },
    "pro-rep-resilience_progress": {
      property: "resilience_progress",
      label: "Climate Resilience Progress",
      inputType: "long-text"
    },
    "pro-rep-local_governance": { property: "local_governance", label: "Governance Progress", inputType: "long-text" },
    "pro-rep-adaptive_management": {
      property: "adaptive_management",
      label: "Adaptative Management",
      inputType: "long-text"
    },
    "pro-rep-scalability_replicability": {
      property: "scalability_replicability",
      label: "Scalability Progress",
      inputType: "long-text"
    },
    "pro-rep-convergence_jobs_description": {
      property: "convergence_jobs_description",
      label: "Description of Convergence Jobs",
      inputType: "long-text"
    },
    "pro-rep-convergence_schemes": {
      property: "convergence_schemes",
      label: "Convergence Schemes",
      inputType: "long-text"
    },
    "pro-rep-convergence_amount": { property: "convergence_amount", label: "Convergence Raised", inputType: "number" },
    "pro-rep-community_partners_assets_description": {
      property: "community_partners_assets_description",
      label: "Community Assests",
      inputType: "long-text"
    },
    "pro-rep-volunteer_scstobc": {
      property: "volunteer_scstobc",
      label: "Volunteers Marginalized",
      inputType: "number"
    },
    "pro-rep-beneficiaries_scstobc_farmers": {
      property: "beneficiaries_scstobc_farmers",
      label: "Community Partners Marginalized Farmers",
      inputType: "number"
    },
    "pro-rep-beneficiaries_scstobc": {
      property: "beneficiaries_scstobc",
      label: "Community Partners Marginalized",
      inputType: "number"
    },
    // TODO (TM-912) Deprecated, to be removed.
    "pro-rep-paid-other-activity-description": {
      property: "paid_other_activity_description",
      label: "Paid Other Activities Description",
      inputType: "long-text"
    },
    "pro-rep-other-workdays-description": {
      property: "other_workdays_description",
      label: "Other Activities Description",
      inputType: "long-text"
    },
    "pro-rep-local-engagement-description": {
      property: "local_engagement_description",
      label: "Response to Local Priorities",
      inputType: "long-text"
    },
    "pro-rep-indirect-beneficiaries": {
      property: "indirect_beneficiaries",
      label: "Number of Indirect Beneficiaries",
      inputType: "number"
    },
    "pro-rep-indirect-beneficiaries-description": {
      property: "indirect_beneficiaries_description",
      label: "Indirect Beneficiaries Description",
      inputType: "long-text"
    },
    "pro-rep-other-restoration-partners-description": {
      property: "other_restoration_partners_description",
      label: "Other Restoration Partners Description",
      inputType: "long-text"
    },
    "pro-rep-total-unique-restoration-partners": {
      property: "total_unique_restoration_partners",
      label: "Total Unique Restoration Partners",
      inputType: "number"
    },
    "pro-rep-business-milestones": {
      property: "business_milestones",
      label: "Business Milestones",
      inputType: "long-text"
    },
    "pro-rep-ft-other": { property: "ft_other", label: "Full Time Other Gender", inputType: "number" },
    "pro-rep-pt-other": { property: "pt_other", label: "Part Time Other Gender", inputType: "number" },
    "pro-rep-volunteer_other": { property: "volunteer_other", label: "Volunteer Other Gender", inputType: "number" },
    "pro-rep-beneficiaries-other": {
      property: "beneficiaries_other",
      label: "Other Gender Beneficiary",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-women": {
      property: "beneficiaries_training_women",
      label: "Women Trained",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-men": {
      property: "beneficiaries_training_men",
      label: "Men Trained",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-other": {
      property: "beneficiaries_training_other",
      label: "Other Gender Trained",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-youth": {
      property: "beneficiaries_training_youth",
      label: "Youth Trained",
      inputType: "number"
    },
    "pro-rep-beneficiaries-training-non-youth": {
      property: "beneficiaries_training_non_youth",
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
      property: "treeSpecies",
      label: "Tree Species (Nursery Seedling)",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "nursery-seedling"
    },
    "pro-rep-rel-paid-nursery-operations": {
      property: "workdaysPaidNurseryOperations",
      label: "Paid Nursery Operations",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-nursery-operations"
    },
    "pro-rep-rel-paid-project-management": {
      property: "workdaysPaidProjectManagement",
      label: "Paid Project Management",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-project-management"
    },
    "pro-rep-rel-paid-other-activities": {
      property: "workdaysPaidOtherActivities",
      label: "Paid Other Activities",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-other-activities"
    },
    "pro-rep-rel-volunteer-nursery-operations": {
      property: "workdaysVolunteerNurseryOperations",
      label: "Volunteer Nursery Operations",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-nursery-operations"
    },
    "pro-rep-rel-volunteer-project-management": {
      property: "workdaysVolunteerProjectManagement",
      label: "Volunteer Project Management",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-project-management"
    },
    "pro-rep-rel-volunteer-other-activities": {
      property: "workdaysVolunteerOtherActivities",
      label: "Volunteer Other Activities",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-other-activities"
    },
    "pro-rep-direct-workdays": {
      property: "workdaysDirect",
      label: "Direct Workday",
      resource: "demographics",
      inputType: "workdays",
      collection: "direct"
    },
    "pro-rep-convergence-workdays": {
      property: "workdaysConvergence",
      label: "Convergence Workday",
      resource: "demographics",
      inputType: "workdays",
      collection: "convergence"
    },
    "pro-rep-direct-income-partners": {
      property: "restorationPartnersDirectIncome",
      label: "Direct Income Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-income"
    },
    "pro-rep-indirect-income-partners": {
      property: "restorationPartnersIndirectIncome",
      label: "Indirect Income Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-income"
    },
    "pro-rep-direct-benefits-partners": {
      property: "restorationPartnersDirectBenefits",
      label: "Direct In-kind Benefits Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-benefits"
    },
    "pro-rep-indirect-benefits-partners": {
      property: "restorationPartnersIndirectBenefits",
      label: "Indirect In-kind Benefits Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-benefits"
    },
    "pro-rep-direct-conservation-payments-partners": {
      property: "restorationPartnersDirectConservationPayments",
      label: "Direct Conservation Agreement Payment Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-conservation-payments"
    },
    "pro-rep-indirect-conservation-payments-partners": {
      property: "restorationPartnersIndirectConservationPayments",
      label: "Indirect Conservation Agreement Payment Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-conservation-payments"
    },
    "pro-rep-direct-market-access-partners": {
      property: "restorationPartnersDirectMarketAccess",
      label: "Direct Increased Market Access Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-market-access"
    },
    "pro-rep-indirect-market-access-partners": {
      property: "restorationPartnersIndirectMarketAccess",
      label: "Indirect Increased Market Access Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-market-access"
    },
    "pro-rep-direct-capacity-partners": {
      property: "restorationPartnersDirectCapacity",
      label: "Direct Increased Capacity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-capacity"
    },
    "pro-rep-indirect-capacity-partners": {
      property: "restorationPartnersIndirectCapacity",
      label: "Indirect Capacity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-capacity"
    },
    "pro-rep-direct-training-partners": {
      property: "restorationPartnersDirectTraining",
      label: "Direct Training Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-training"
    },
    "pro-rep-indirect-training-partners": {
      property: "restorationPartnersIndirectTraining",
      label: "Indirect Training Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-training"
    },
    "pro-rep-direct-land-title-partners": {
      property: "restorationPartnersDirectLandTitle",
      label: "Direct Newly Secured Land Title Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-land-title"
    },
    "pro-rep-indirect-land-title-partners": {
      property: "restorationPartnersIndirectLandTitle",
      label: "Indirect Newly Secured Land Title Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-land-title"
    },
    "pro-rep-direct-livelihoods-partners": {
      property: "restorationPartnersDirectLivelihoods",
      label: "Direct Traditional Livelihoods or Customer Rights Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-livelihoods"
    },
    "pro-rep-indirect-livelihoods-partners": {
      property: "restorationPartnersIndirectLivelihoods",
      label: "Indirect Traditional Livelihoods or Customer Rights Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-livelihoods"
    },
    "pro-rep-direct-productivity-partners": {
      property: "restorationPartnersDirectProductivity",
      label: "Direct Increased Productivity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-productivity"
    },
    "pro-rep-indirect-productivity-partners": {
      property: "restorationPartnersIndirectProductivity",
      label: "Indirect Increased Productivity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-productivity"
    },
    "pro-rep-direct-other-partners": {
      property: "restorationPartnersDirectOther",
      label: "Direct Other Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-other"
    },
    "pro-rep-indirect-other-partners": {
      property: "restorationPartnersIndirectOther",
      label: "Indirect Other Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-other"
    },
    "pro-rep-full-time-jobs": {
      property: "jobsFullTime",
      label: "Full-time Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "full-time"
    },
    "pro-rep-full-time-clt-jobs": {
      property: "jobsFullTimeClt",
      label: "Full-time CLT Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "full-time-clt"
    },
    "pro-rep-part-time-jobs": {
      property: "jobsPartTime",
      label: "Part-time Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "part-time"
    },
    "pro-rep-part-time-clt-jobs": {
      property: "jobsPartTimeClt",
      label: "Part-time CLT Jobs",
      resource: "demographics",
      inputType: "jobs",
      collection: "part-time-clt"
    },
    "pro-rep-volunteers": {
      property: "volunteers",
      label: "Volunteers",
      resource: "demographics",
      inputType: "volunteers",
      collection: "volunteer"
    },
    "pro-rep-beneficiaries-all": {
      property: "allBeneficiaries",
      label: "All Beneficiaries",
      resource: "demographics",
      inputType: "allBeneficiaries",
      collection: "all"
    },
    "pro-rep-beneficiaries-training": {
      property: "trainingBeneficiaries",
      label: "Training Beneficiaries",
      resource: "demographics",
      inputType: "trainingBeneficiaries",
      collection: "training"
    },
    "pro-rep-associates": {
      property: "associates",
      label: "Associates",
      resource: "demographics",
      inputType: "associates",
      collection: "all"
    }
  }
};
