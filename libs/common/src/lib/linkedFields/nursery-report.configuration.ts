import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { NurseryReport } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const NurseryReportConfiguration: LinkedFieldConfiguration = {
  label: "Nursery Report",
  laravelModelType: NurseryReport.LARAVEL_TYPE,
  fields: {
    "nur-rep-title": { property: "title", label: "Title", inputType: "text" },
    "nur-rep-seedlings-young-trees": {
      property: "seedlings_young_trees",
      label: "Seedlings young trees",
      inputType: "number"
    },
    "nur-rep-interesting-facts": { property: "interesting_facts", label: "Interesting facts", inputType: "long-text" },
    "nur-rep-site-prep": { property: "site_prep", label: "Site prep", inputType: "long-text" },
    "nur-rep-shared-drive-link": { property: "shared_drive_link", label: "Shared drive link", inputType: "url" }
  },
  fileCollections: {
    "nur-rep-col-file": { property: "file", label: "File", inputType: "file", multiChoice: true },
    "nur-rep-col-other-additional-documents": {
      property: "other_additional_documents",
      label: "Other additional documents",
      inputType: "file",
      multiChoice: true
    },
    "nur-rep-col-photos": { property: "photos", label: "Photos", inputType: "file", multiChoice: true },
    "nur-rep-col-tree-seedling-contributions": {
      property: "tree_seedling_contributions",
      label: "Tree seedling contributions",
      inputType: "file",
      multiChoice: true
    }
  },
  relations: {
    "nur-rep-rel-tree-species": {
      property: "treeSpecies",
      label: "Tree Species",
      resource: "App\\Http\\Resources\\V2\\TreeSpecies\\TreeSpeciesResource",
      inputType: "treeSpecies",
      collection: "nursery-seedling"
    }
  }
};
