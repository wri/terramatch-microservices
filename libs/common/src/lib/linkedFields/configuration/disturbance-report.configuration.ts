import { LinkedFieldConfiguration } from "../types";
import { DisturbanceReport } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const DisturbanceReportConfiguration: LinkedFieldConfiguration = {
  label: "Disturbance Report",
  laravelModelType: DisturbanceReport.LARAVEL_TYPE,
  fields: {
    "dis-rep-disturbance-type": {
      property: "disturbance_type",
      label: "Disturbance Type",
      inputType: "select",
      multiChoice: false,
      optionListKey: "disturbance-types-collection"
    },
    "dis-rep-disturbance-subtype": {
      property: "disturbance_subtype",
      label: "Disturbance Subtype",
      inputType: "select",
      multiChoice: true,
      optionListKey: "disturbance-subtypes-collection"
    },
    "dis-rep-intensity": {
      property: "intensity",
      label: "Intensity",
      inputType: "select",
      multiChoice: false,
      optionListKey: "intensity-collection"
    },
    "dis-rep-extent": {
      property: "extent",
      label: "Extent",
      inputType: "select",
      multiChoice: false,
      optionListKey: "extent-collection"
    },
    "dis-rep-people-affected": { property: "people_affected", label: "People Affected", inputType: "number" },
    "dis-rep-monetary-damage": { property: "monetary_damage", label: "Monetary Damage", inputType: "number" },
    "dis-rep-property-affected": {
      property: "property_affected",
      label: "Property Affected",
      inputType: "select",
      multiChoice: true,
      optionListKey: "property-affected-collection"
    },
    "dis-rep-date-of-disturbance": { property: "date_of_disturbance", label: "Date of Disturbance", inputType: "date" },
    "dis-rep-site-affected": {
      property: "site_affected",
      label: "Site Affected",
      inputType: "disturbanceAffectedSite"
    },
    "dis-rep-polygon-affected": {
      property: "polygon_affected",
      label: "Polygon Affected",
      inputType: "disturbanceAffectedPolygon"
    },
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
  relations: {}
};
