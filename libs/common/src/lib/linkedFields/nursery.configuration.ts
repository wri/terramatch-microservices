import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { Nursery } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const NurseryConfiguration: LinkedFieldConfiguration<Nursery> = {
  label: "Nursery",
  fields: {
    "nur-name": { property: "name", label: "Name", inputType: "text" },
    "nur-type": {
      property: "type",
      label: "type",
      inputType: "select",
      multiChoice: false,
      optionListKey: "nursery-type"
    },
    "nur-start_date": { property: "startDate", label: "Start date", inputType: "date" },
    "nur-end_date": { property: "endDate", label: "End date", inputType: "date" },
    "nur-seedling_grown": { property: "seedlingGrown", label: "Seedlings grown", inputType: "number" },
    "nur-planting_contribution": {
      property: "plantingContribution",
      label: "Planting contribution",
      inputType: "long-text"
    }
  },
  fileCollections: {
    "nur-col-media": { collection: "media", label: "Media", inputType: "file", multiChoice: true },
    "nur-col-file": { collection: "file", label: "File", inputType: "file", multiChoice: true },
    "nur-col-other-additional-documents": {
      collection: "other_additional_documents",
      label: "Other additional documents",
      inputType: "file",
      multiChoice: true
    },
    "nur-col-photos": { collection: "photos", label: "Photos", inputType: "file", multiChoice: true }
  },
  relations: {
    "nur-rel-tree-species": {
      label: "Tree Species",
      resource: "treeSpecies",
      inputType: "treeSpecies",
      collection: "nursery-seedling"
    }
  }
};
