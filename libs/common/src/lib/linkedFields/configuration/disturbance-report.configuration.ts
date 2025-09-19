import { LinkedFieldConfiguration } from "../types";
import { DisturbanceReport } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const DisturbanceReportConfiguration: LinkedFieldConfiguration = {
  label: "Disturbance Report",
  laravelModelType: DisturbanceReport.LARAVEL_TYPE,
  fields: {
    "dis-rep-description": { property: "description", label: "Description", inputType: "long-text" },
    "dis-rep-action-description": {
      property: "action_description",
      label: "Action Description",
      inputType: "long-text"
    }
  },
  fileCollections: {
    "dis-rep-media-assets": { property: "media", label: "Media Assets", inputType: "file", multiChoice: true }
  },
  relations: {
    "dis-rep-entries": {
      property: "entries",
      label: "Disturbance Entries",
      resource: "App\\Http\\Resources\\V2\\DisturbanceReportEntryResource",
      inputType: "disturbanceReportEntries"
    }
  }
};
