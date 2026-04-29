import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { SiteReport } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const SiteReportConfiguration: LinkedFieldConfiguration<SiteReport> = {
  label: "Site Report",
  fields: {
    "site-rep-title": { property: "title", label: "Title", inputType: "text" },
    "site-rep-shared-drive-link": { property: "sharedDriveLink", label: "Shared drive link", inputType: "url" },
    "site-rep-technical-narrative": {
      property: "technicalNarrative",
      label: "Technical narrative",
      inputType: "long-text"
    },
    "site-rep-public-narrative": { property: "publicNarrative", label: "Public narrative", inputType: "long-text" },
    "site-rep-disturbance-details": {
      property: "disturbanceDetails",
      label: "Additional Disturbance Details",
      inputType: "long-text"
    },
    // @deprecated - this should not be used in new forms
    "site-rep-workdays-paid": { property: "workdaysPaid", label: "Workdays paid", inputType: "number" },
    "site-rep-seeds-planted": { property: "seedsPlanted", label: "Seeds planted", inputType: "number" },
    // @deprecated - this should not be used in new forms
    "site-rep-workdays-volunteer": { property: "workdaysVolunteer", label: "Workdays volunteer", inputType: "number" },
    "site-rep-polygon-status": { property: "polygonStatus", label: "Polygon status", inputType: "long-text" },
    "site-rep-planting-status": {
      property: "plantingStatus",
      label: "Planting status",
      inputType: "select",
      multiChoice: false,
      optionListKey: "planting-status"
    },
    "site-rep-invasive_species_removed": {
      property: "invasiveSpeciesRemoved",
      label: "Invasive Species Removed",
      inputType: "long-text"
    },
    "site-rep-invasive_species_management": {
      property: "invasiveSpeciesManagement",
      label: "Invasive Species Management Plan",
      inputType: "long-text"
    },
    "site-rep-soil_water_restoration_description": {
      property: "soilWaterRestorationDescription",
      label: "Soil + Water Restoration Methods",
      inputType: "long-text"
    },
    "site-rep-water_structures": {
      property: "waterStructures",
      label: "Water Structures Created",
      inputType: "long-text"
    },
    "site-rep-site_community_partners_description": {
      property: "siteCommunityPartnersDescription",
      label: "Community Partners (Site)",
      inputType: "long-text"
    },
    "site-rep-site_community_partners_income_increase_description": {
      property: "siteCommunityPartnersIncomeIncreaseDescription",
      label: "Community Partners Income Increase (Site)",
      inputType: "long-text"
    },
    // TODO (TM-912) Deprecated, to be removed.
    "site-rep-paid-other-activity-description": {
      property: "paidOtherActivityDescription",
      label: "Paid Other Activities Description",
      inputType: "long-text"
    },
    "site-rep-other-workdays-description": {
      virtual: {
        type: "trackingDescription",
        domain: "demographics",
        trackingType: "workdays",
        collections: ["paid-other-activities", "volunteer-other-activities"]
      },
      label: "Other Activities Description",
      exportHeading: "otherWorkdaysDescription",
      inputType: "long-text"
    },
    "site-rep-num-trees-regenerating": {
      property: "numTreesRegenerating",
      label: "Estimate Number of Trees Restored via ANR",
      inputType: "number"
    },
    "site-rep-regeneration-description": {
      property: "regenerationDescription",
      label: "Description of ANR Activities",
      inputType: "long-text"
    },
    "site-rep-pct-survival-to-date": {
      property: "pctSurvivalToDate",
      label: "Survival Rate",
      inputType: "number-percentage"
    },
    "site-rep-survival-calculation": {
      property: "survivalCalculation",
      label: "Description of Survival Rate Calculation",
      inputType: "long-text"
    },
    "site-rep-survival-description": {
      property: "survivalDescription",
      label: "Explanation of Survival Rate",
      inputType: "long-text"
    },
    "site-rep-maintenance-activities": {
      property: "maintenanceActivities",
      label: "Maintenance Activities",
      inputType: "long-text"
    },
    "site-rep-anr-practices": {
      property: "anrPractices",
      label: "ANR Practices",
      inputType: "select",
      multiChoice: true,
      optionListKey: "anr-practices"
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
      exportHeading: "replantingTreeSpecies",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "replanting"
    },
    "site-rep-rel-tree-species": {
      label: "Tree Species",
      exportHeading: "treeSpecies",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "tree-planted"
    },
    "site-rep-rel-non-tree-species": {
      label: "Non Tree Species",
      exportHeading: "nonTreeSpecies",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "non-tree"
    },
    "site-rep-rel-anr-tree-species": {
      label: "Regenerating Species",
      exportHeading: "anrTreeSpecies",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "anr"
    },
    "site-rep-rel-disturbances": {
      label: "Disturbances",
      exportHeading: "disturbances",
      resource: "disturbances",
      inputType: "disturbances",
      collection: "disturbance"
    },
    "site-rep-rel-seedings": {
      label: "Seedings",
      exportHeading: "seedings",
      resource: "seedings",
      inputType: "seedings"
    },
    "site-rep-rel-paid-site-establishment": {
      label: "Paid Site Establishment",
      exportHeading: "workdaysPaidSiteEstablishment",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-site-establishment"
    },
    "site-rep-rel-paid-planting": {
      label: "Paid Planting",
      exportHeading: "workdaysPaidPlanting",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-planting"
    },
    "site-rep-rel-paid-site-maintenance": {
      label: "Paid Site Maintenance",
      exportHeading: "workdaysPaidSiteMaintenance",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-site-maintenance"
    },
    "site-rep-rel-paid-site-monitoring": {
      label: "Paid Site Monitoring",
      exportHeading: "workdaysPaidSiteMonitoring",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-site-monitoring"
    },
    "site-rep-rel-paid-other-activities": {
      label: "Paid Other Activities",
      exportHeading: "workdaysPaidOtherActivities",
      resource: "demographics",
      inputType: "workdays",
      collection: "paid-other-activities"
    },
    "site-rep-rel-volunteer-site-establishment": {
      label: "Volunteer Site Establishment",
      exportHeading: "workdaysVolunteerSiteEstablishment",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-site-establishment"
    },
    "site-rep-rel-volunteer-planting": {
      label: "Volunteer Planting",
      exportHeading: "workdaysVolunteerPlanting",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-planting"
    },
    "site-rep-rel-volunteer-site-maintenance": {
      label: "volunteer Site Maintenance",
      exportHeading: "workdaysVolunteerSiteMaintenance",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-site-maintenance"
    },
    "site-rep-rel-volunteer-site-monitoring": {
      label: "Volunteer Site Monitoring",
      exportHeading: "workdaysVolunteerSiteMonitoring",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-site-monitoring"
    },
    "site-rep-rel-volunteer-other-activities": {
      label: "Volunteer Other Activities",
      exportHeading: "workdaysVolunteerOtherActivities",
      resource: "demographics",
      inputType: "workdays",
      collection: "volunteer-other-activities"
    },
    "site-rep-direct-workdays": {
      label: "Direct Workday",
      exportHeading: "workdaysDirect",
      resource: "demographics",
      inputType: "workdays",
      collection: "direct"
    },
    "site-rep-convergence-workdays": {
      label: "Convergence Workday",
      exportHeading: "workdaysConvergence",
      resource: "demographics",
      inputType: "workdays",
      collection: "convergence"
    }
  }
};
