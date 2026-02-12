import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { Site } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const SiteConfiguration: LinkedFieldConfiguration<Site> = {
  label: "Site",
  fields: {
    "site-name": { property: "name", label: "Name", inputType: "text" },
    "site-control-site": { property: "controlSite", label: "Control site", inputType: "boolean" },
    "site-boundary-geojson": { property: "boundaryGeojson", label: "Boundary geojson", inputType: "mapInput" },
    "site-land-use-types": {
      property: "landUseTypes",
      label: "Land use types",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "land-use-systems"
    },
    "site-restoration-strategy": {
      property: "restorationStrategy",
      label: "Restoration strategy",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-strategies"
    },
    "site-anr-practices": {
      property: "anrPractices",
      label: "ANR practices",
      inputType: "select",
      multiChoice: true,
      optionListKey: "anr-practices"
    },
    "site-description": { property: "description", label: "Description", inputType: "long-text" },
    "site-history": { property: "history", label: "History", inputType: "long-text" },
    "site-land-tenures": {
      property: "landTenures",
      label: "Land tenures",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "land-tenures"
    },
    "site-landscape-community-contribution": {
      property: "landscapeCommunityContribution",
      label: "Landscape community contribution",
      inputType: "long-text"
    },
    "site-planting-pattern": { property: "plantingPattern", label: "Planting pattern", inputType: "long-text" },
    "site-soil-condition": {
      property: "soilCondition",
      label: "Soil condition",
      inputType: "select",
      multiChoice: false,
      optionListKey: "soil-condition"
    },
    "site-survival-rate-planted": {
      property: "survivalRatePlanted",
      label: "Survival rate planted",
      inputType: "number"
    },
    "site-direct-seeding-survival-rate": {
      property: "directSeedingSurvivalRate",
      label: "Direct seeding survival rate",
      inputType: "number"
    },
    "site-a-nat-regeneration-trees-per-hectare": {
      property: "aNatRegenerationTreesPerHectare",
      label: "A natural regeneration trees per hectare",
      inputType: "number"
    },
    "site-a-nat-regeneration": { property: "aNatRegeneration", label: "A natural regeneration", inputType: "number" },
    "site-hectares_to_restore-goal": {
      property: "hectaresToRestoreGoal",
      label: "Hectares to restore_goal",
      inputType: "number"
    },
    "site-aim-year-five-crown-cover": {
      property: "aimYearFiveCrownCover",
      label: "Aim year five crown cover",
      inputType: "number"
    },
    "site-aim-number-of-mature-trees": {
      property: "aimNumberOfMatureTrees",
      label: "Aim number of mature trees",
      inputType: "number"
    },
    "site-start-date": { property: "startDate", label: "Start date", inputType: "date" },
    "site-end-date": { property: "endDate", label: "End date", inputType: "date" },
    "site-description-siting-strategy": {
      property: "descriptionSitingStrategy",
      label: "Description siting strategy",
      inputType: "text"
    },
    "site-col-siting-strategy": {
      property: "sitingStrategy",
      label: "Siting Strategy",
      inputType: "select",
      multiChoice: false,
      optionListKey: "siting-strategies"
    },
    "site-detailed-rst-inv-types": {
      property: "detailedInterventionTypes",
      label: "Detailed intervention types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "interventions"
    }
  },
  fileCollections: {
    "site-col-media": { collection: "media", label: "Media", inputType: "file", multiChoice: true },
    "site-col-socioeconomic-benefits": {
      collection: "socioeconomic_benefits",
      label: "Socioeconomic benefits",
      inputType: "file",
      multiChoice: true
    },
    "site-col-file": { collection: "file", label: "File", inputType: "file", multiChoice: true },
    "site-col-other-additional-documents": {
      collection: "other_additional_documents",
      label: "Other additional documents",
      inputType: "file",
      multiChoice: true
    },
    "site-col-photos": { collection: "photos", label: "Photos", inputType: "file", multiChoice: true },
    "site-col-document-files": {
      collection: "document_files",
      label: "Document files",
      inputType: "file",
      multiChoice: true
    },
    "site-col-tree-species": {
      collection: "tree_species",
      label: "programme_submission",
      inputType: "file",
      multiChoice: true
    },
    "site-col-strat-for-heterogeneity": {
      collection: "stratification_for_heterogeneity",
      label: "Stratification for heterogeneity",
      inputType: "file",
      multiChoice: false
    }
  },
  relations: {
    "site-rel-tree-species": {
      label: "Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "tree-planted"
    },
    "site-rel-non-tree-species": {
      label: "Non Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "non-tree"
    },
    "site-rel-disturbances": {
      label: "Disturbances",
      resource: "disturbances",
      inputType: "disturbances",
      collection: "disturbance"
    },
    "site-rel-invasive": {
      label: "Invasives",
      resource: "invasives",
      inputType: "invasive",
      collection: "invasive"
    },
    "site-rel-seedings": {
      label: "Seedings",
      resource: "seedings",
      inputType: "seedings"
    },
    "site-rel-stratas": {
      label: "Stratas",
      resource: "stratas",
      inputType: "stratas"
    }
  }
};
