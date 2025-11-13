import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { SiteReport } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const SiteReportConfiguration: LinkedFieldConfiguration = {
  label: "Site Report",
  laravelModelType: SiteReport.LARAVEL_TYPE,
  fields: {
    "site-rep-title": { property: "title", label: "Title", inputType: "text" },
    "site-rep-shared-drive-link": { property: "shared_drive_link", label: "Shared drive link", inputType: "url" },
    "site-rep-technical-narrative": {
      property: "technical_narrative",
      label: "Technical narrative",
      inputType: "long-text"
    },
    "site-rep-public-narrative": { property: "public_narrative", label: "Public narrative", inputType: "long-text" },
    "site-rep-disturbance-details": {
      property: "disturbance_details",
      label: "Additional Disturbance Details",
      inputType: "long-text"
    },
    "site-rep-workdays-paid": { property: "workdays_paid", label: "Workdays paid", inputType: "number" },
    "site-rep-seeds-planted": { property: "seeds_planted", label: "Seeds planted", inputType: "number" },
    "site-rep-workdays-volunteer": { property: "workdays_volunteer", label: "Workdays volunteer", inputType: "number" },
    "site-rep-polygon-status": { property: "polygon_status", label: "Polygon status", inputType: "long-text" },
    "site-rep-planting-status": {
      property: "planting_status",
      label: "Planting status",
      inputType: "select",
      multiChoice: false,
      optionListKey: "planting-status"
    },
    "site-rep-invasive_species_removed": {
      property: "invasive_species_removed",
      label: "Invasive Species Removed",
      inputType: "long-text"
    },
    "site-rep-invasive_species_management": {
      property: "invasive_species_management",
      label: "Invasive Species Management Plan",
      inputType: "long-text"
    },
    "site-rep-soil_water_restoration_description": {
      property: "soil_water_restoration_description",
      label: "Soil + Water Restoration Methods",
      inputType: "long-text"
    },
    "site-rep-water_structures": {
      property: "water_structures",
      label: "Water Structures Created",
      inputType: "long-text"
    },
    "site-rep-site_community_partners_description": {
      property: "site_community_partners_description",
      label: "Community Partners (Site)",
      inputType: "long-text"
    },
    "site-rep-site_community_partners_income_increase_description": {
      property: "site_community_partners_income_increase_description",
      label: "Community Partners Income Increase (Site)",
      inputType: "long-text"
    },
    // TODO (TM-912) Deprecated, to be removed.
    "site-rep-paid-other-activity-description": {
      property: "paid_other_activity_description",
      label: "Paid Other Activities Description",
      inputType: "long-text"
    },
    "site-rep-other-workdays-description": {
      property: "other_workdays_description",
      label: "Other Activities Description",
      inputType: "long-text"
    },
    "site-rep-num-trees-regenerating": {
      property: "num_trees_regenerating",
      label: "Estimate Number of Trees Restored via ANR",
      inputType: "number"
    },
    "site-rep-regeneration-description": {
      property: "regeneration_description",
      label: "Description of ANR Activities",
      inputType: "long-text"
    },
    "site-rep-pct-survival-to-date": {
      property: "pct_survival_to_date",
      label: "Survival Rate",
      inputType: "number-percentage"
    },
    "site-rep-survival-calculation": {
      property: "survival_calculation",
      label: "Description of Survival Rate Calculation",
      inputType: "long-text"
    },
    "site-rep-survival-description": {
      property: "survival_description",
      label: "Explanation of Survival Rate",
      inputType: "long-text"
    },
    "site-rep-maintenance-activities": {
      property: "maintenance_activities",
      label: "Maintenance Activities",
      inputType: "long-text"
    }
  },
  fileCollections: {
    "site-rep-col-media": { collection: "media", label: "Media", inputType: "file", multiChoice: true },
    "site-rep-col-socioeconomic-benefits": {
      collection: "socioeconomic_benefits",
      label: "Socioeconomic benefits",
      inputType: "file",
      multiChoice: true
    },
    "site-rep-col-file": { collection: "file", label: "File", inputType: "file", multiChoice: true },
    "site-rep-col-other-additional-documents": {
      collection: "other_additional_documents",
      label: "Other additional documents",
      inputType: "file",
      multiChoice: true
    },
    "site-rep-col-photos": { collection: "photos", label: "Photos", inputType: "file", multiChoice: true },
    "site-rep-col-document-files": {
      collection: "document_files",
      label: "Photos",
      inputType: "file",
      multiChoice: true
    },
    "site-rep-col-tree-species": {
      collection: "tree_species",
      label: "programme_submission",
      inputType: "file",
      multiChoice: true
    },
    "site-rep-col-site-submission": {
      collection: "site_submission",
      label: "Site submission",
      inputType: "file",
      multiChoice: true
    },
    "site-rep-col-tree-planting-upload": {
      collection: "tree_planting_upload",
      label: "Tree Planting Upload",
      inputType: "file",
      multiChoice: true
    },
    "site-rep-col-anr-photos": { collection: "anr_photos", label: "ANR Photos", inputType: "file", multiChoice: true },
    "site-rep-col-soil-water-conservation-upload": {
      collection: "soil_water_conservation_upload",
      label: "Soil or Water Conservation Upload",
      inputType: "file",
      multiChoice: true
    },
    "site-rep-col-soil-water-conservation-photos": {
      collection: "soil_water_conservation_photos",
      label: "Soil or Water Conservation Photos",
      inputType: "file",
      multiChoice: true
    }
  },
  relations: {
    "site-rep-rel-replanting-tree-species": {
      label: "Replanting Species + Count",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "replanting"
    },
    "site-rep-rel-tree-species": {
      label: "Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "tree-planted"
    },
    "site-rep-rel-non-tree-species": {
      label: "Non Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "non-tree"
    },
    "site-rep-rel-disturbances": {
      label: "Disturbances",
      resource: "disturbances",
      inputType: "disturbances",
      collection: "disturbance"
    },
    "site-rep-rel-seedings": {
      label: "Seedings",
      resource: "seedings",
      inputType: "seedings"
    },
    "site-rep-rel-paid-site-establishment": {
      label: "Paid Site Establishment",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-site-establishment"
    },
    "site-rep-rel-paid-planting": {
      label: "Paid Planting",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-planting"
    },
    "site-rep-rel-paid-site-maintenance": {
      label: "Paid Site Maintenance",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-site-maintenance"
    },
    "site-rep-rel-paid-site-monitoring": {
      label: "Paid Site Monitoring",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-site-monitoring"
    },
    "site-rep-rel-paid-other-activities": {
      label: "Paid Other Activities",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-other-activities"
    },
    "site-rep-rel-volunteer-site-establishment": {
      label: "Volunteer Site Establishment",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-site-establishment"
    },
    "site-rep-rel-volunteer-planting": {
      label: "Volunteer Planting",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-planting"
    },
    "site-rep-rel-volunteer-site-maintenance": {
      label: "volunteer Site Maintenance",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-site-maintenance"
    },
    "site-rep-rel-volunteer-site-monitoring": {
      label: "Volunteer Site Monitoring",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-site-monitoring"
    },
    "site-rep-rel-volunteer-other-activities": {
      label: "Volunteer Other Activities",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-other-activities"
    },
    "site-rep-direct-workdays": {
      label: "Direct Workday",
      resource: "demographics",
      inputType: "workdays",
      collection: "direct"
    },
    "site-rep-convergence-workdays": {
      label: "Convergence Workday",
      resource: "demographics",
      inputType: "workdays",
      collection: "convergence"
    }
  }
};
