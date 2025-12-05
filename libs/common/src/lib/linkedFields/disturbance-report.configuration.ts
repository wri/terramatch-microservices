import { DisturbanceReport } from "@terramatch-microservices/database/entities";
import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const DisturbanceReportConfiguration: LinkedFieldConfiguration<DisturbanceReport> = {
  label: "Disturbance Report",
  fields: {
    "dis-rep-description": { property: "description", label: "Description", inputType: "long-text" },
    "dis-rep-action-description": {
      property: "actionDescription",
      label: "Action Description",
      inputType: "long-text"
    }
  },
  fileCollections: {
    "dis-rep-media-assets": { collection: "media", label: "Media Assets", inputType: "file", multiChoice: true }
  },
  relations: {
    "dis-rep-entries": {
      label: "Disturbance Entries",
      resource: "disturbanceReportEntries",
      inputType: "disturbanceReportEntries"
    }
  }
};
