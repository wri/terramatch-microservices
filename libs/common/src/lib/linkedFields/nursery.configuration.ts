import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { Nursery } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const NurseryConfiguration: LinkedFieldConfiguration = {
  label: "Nursery",
  laravelModelType: Nursery.LARAVEL_TYPE,
  fields: {
    "nur-name": { property: "name", label: "Name", inputType: "text" },
    "nur-type": {
      property: "type",
      label: "type",
      inputType: "select",
      multiChoice: false,
      optionListKey: "nursery-type"
    },
    "nur-start_date": { property: "start_date", label: "Start date", inputType: "date" },
    "nur-end_date": { property: "end_date", label: "End date", inputType: "date" },
    "nur-seedling_grown": { property: "seedling_grown", label: "Seedlings grown", inputType: "number" },
    "nur-planting_contribution": {
      property: "planting_contribution",
      label: "Planting contribution",
      inputType: "long-text"
    }
  },
  fileCollections: {
    "nur-col-media": { property: "media", label: "Media", inputType: "file", multiChoice: true },
    "nur-col-file": { property: "file", label: "File", inputType: "file", multiChoice: true },
    "nur-col-other-additional-documents": {
      property: "other_additional_documents",
      label: "Other additional documents",
      inputType: "file",
      multiChoice: true
    },
    "nur-col-photos": { property: "photos", label: "Photos", inputType: "file", multiChoice: true }
  },
  relations: {
    "nur-rel-tree-species": {
      property: "treeSpecies",
      label: "Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "nursery-seedling"
    }
  }
};
