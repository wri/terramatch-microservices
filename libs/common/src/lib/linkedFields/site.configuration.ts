import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { Site } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const SiteConfiguration: LinkedFieldConfiguration = {
  label: "Site",
  laravelModelType: Site.LARAVEL_TYPE,
  fields: {
    "site-name": { property: "name", label: "Name", inputType: "text" },
    "site-control-site": { property: "control_site", label: "Control site", inputType: "boolean" },
    "site-boundary-geojson": { property: "boundary_geojson", label: "Boundary geojson", inputType: "mapInput" },
    "site-land-use-types": {
      property: "land_use_types",
      label: "Land use types",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-systems"
    },
    "site-restoration-strategy": {
      property: "restoration_strategy",
      label: "Restoration strategy",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "restoration-practices"
    },
    "site-description": { property: "description", label: "Description", inputType: "long-text" },
    "site-history": { property: "history", label: "History", inputType: "long-text" },
    "site-land-tenures": {
      property: "land_tenures",
      label: "Land tenures",
      inputType: "select-image",
      multiChoice: true,
      optionListKey: "land-tenures"
    },
    "site-landscape-community-contribution": {
      property: "landscape_community_contribution",
      label: "Landscape community contribution",
      inputType: "long-text"
    },
    "site-planting-pattern": { property: "planting_pattern", label: "Planting pattern", inputType: "long-text" },
    "site-soil-condition": {
      property: "soil_condition",
      label: "Soil condition",
      inputType: "select",
      multiChoice: false,
      optionListKey: "soil-condition"
    },
    "site-survival-rate-planted": {
      property: "survival_rate_planted",
      label: "Survival rate planted",
      inputType: "number"
    },
    "site-direct-seeding-survival-rate": {
      property: "direct_seeding_survival_rate",
      label: "Direct seeding survival rate",
      inputType: "number"
    },
    "site-a-nat-regeneration-trees-per-hectare": {
      property: "a_nat_regeneration_trees_per_hectare",
      label: "A natural regeneration trees per hectare",
      inputType: "number"
    },
    "site-a-nat-regeneration": { property: "a_nat_regeneration", label: "A natural regeneration", inputType: "number" },
    "site-hectares_to_restore-goal": {
      property: "hectares_to_restore_goal",
      label: "Hectares to restore_goal",
      inputType: "number"
    },
    "site-aim-year-five-crown-cover": {
      property: "aim_year_five_crown_cover",
      label: "Aim year five crown cover",
      inputType: "number"
    },
    "site-aim-number-of-mature-trees": {
      property: "aim_number_of_mature_trees",
      label: "Aim number of mature trees",
      inputType: "number"
    },
    "site-start-date": { property: "start_date", label: "Start date", inputType: "date" },
    "site-end-date": { property: "end_date", label: "End date", inputType: "date" },
    "site-description-siting-strategy": {
      property: "description_siting_strategy",
      label: "Description siting strategy",
      inputType: "text"
    },
    "site-col-siting-strategy": {
      property: "siting_strategy",
      label: "Siting Strategy",
      inputType: "select",
      multiChoice: false,
      optionListKey: "siting-strategy-collection"
    },
    "site-detailed-rst-inv-types": {
      property: "detailed_intervention_types",
      label: "Detailed intervention types",
      inputType: "select",
      multiChoice: true,
      optionListKey: "interventions"
    }
  },
  fileCollections: {
    "site-col-media": { property: "media", label: "Media", inputType: "file", multiChoice: true },
    "site-col-socioeconomic-benefits": {
      property: "socioeconomic_benefits",
      label: "Socioeconomic benefits",
      inputType: "file",
      multiChoice: true
    },
    "site-col-file": { property: "file", label: "File", inputType: "file", multiChoice: true },
    "site-col-other-additional-documents": {
      property: "other_additional_documents",
      label: "Other additional documents",
      inputType: "file",
      multiChoice: true
    },
    "site-col-photos": { property: "photos", label: "Photos", inputType: "file", multiChoice: true },
    "site-col-document-files": {
      property: "document_files",
      label: "Document files",
      inputType: "file",
      multiChoice: true
    },
    "site-col-tree-species": {
      property: "tree_species",
      label: "programme_submission",
      inputType: "file",
      multiChoice: true
    },
    "site-col-strat-for-heterogeneity": {
      property: "stratification_for_heterogeneity",
      label: "Stratification for heterogeneity",
      inputType: "file",
      multiChoice: false
    }
  },
  relations: {
    "site-rel-tree-species": {
      property: "treeSpecies",
      label: "Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "tree-planted"
    },
    "site-rel-non-tree-species": {
      property: "nonTreeSpecies",
      label: "Non Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "non-tree"
    },
    "site-rel-disturbances": {
      property: "disturbances",
      label: "Disturbances",
      resource: "disturbances",
      inputType: "disturbances",
      collection: "disturbance"
    },
    "site-rel-invasive": {
      property: "invasives",
      label: "Invasives",
      resource: "invasives",
      inputType: "invasive",
      collection: "invasive"
    },
    "site-rel-seedings": {
      property: "seedings",
      label: "Seedings",
      resource: "seedings",
      inputType: "seedings"
    },
    "site-rel-stratas": {
      property: "stratas",
      label: "Stratas",
      resource: "stratas",
      inputType: "stratas"
    }
  }
};
