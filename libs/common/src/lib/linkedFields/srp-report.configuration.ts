import { SrpReport } from "@terramatch-microservices/database/entities";
import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const SrpReportConfiguration: LinkedFieldConfiguration = {
  label: "Annual Socio Economic Restoration Report",
  laravelModelType: SrpReport.LARAVEL_TYPE,
  fields: {
    "srp-other-partners-description": {
      property: "other_restoration_partners_description",
      label: "Other Restoration Partners Description",
      inputType: "long-text"
    },
    "srp-total-unique-restoration-partners": {
      property: "total_unique_restoration_partners",
      label: "Total Unique Restoration Partners",
      inputType: "number"
    }
  },
  fileCollections: {},
  relations: {
    "srp-rep-direct-income-partners": {
      label: "Direct Income Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-income"
    },
    "srp-rep-indirect-income-partners": {
      label: "Indirect Income Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-income"
    },
    "srp-rep-direct-benefits-partners": {
      label: "Direct In-kind Benefits Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-benefits"
    },
    "srp-rep-indirect-benefits-partners": {
      label: "Indirect In-kind Benefits Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-benefits"
    },
    "srp-rep-direct-conservation-payments-partners": {
      label: "Direct Conservation Agreement Payment Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-conservation-payments"
    },
    "srp-rep-indirect-conservation-payments-partners": {
      label: "Indirect Conservation Agreement Payment Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-conservation-payments"
    },
    "srp-rep-direct-market-access-partners": {
      label: "Direct Increased Market Access Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-market-access"
    },
    "srp-rep-indirect-market-access-partners": {
      label: "Indirect Increased Market Access Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-market-access"
    },
    "srp-rep-direct-capacity-partners": {
      label: "Direct Increased Capacity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-capacity"
    },
    "srp-rep-indirect-capacity-partners": {
      label: "Indirect Capacity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-capacity"
    },
    "srp-rep-direct-training-partners": {
      label: "Direct Training Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-training"
    },
    "srp-rep-indirect-training-partners": {
      label: "Indirect Training Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-training"
    },
    "srp-rep-direct-land-title-partners": {
      label: "Direct Newly Secured Land Title Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-land-title"
    },
    "srp-rep-indirect-land-title-partners": {
      label: "Indirect Newly Secured Land Title Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-land-title"
    },
    "srp-rep-direct-livelihoods-partners": {
      label: "Direct Traditional Livelihoods or Customer Rights Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-livelihoods"
    },
    "srp-rep-indirect-livelihoods-partners": {
      label: "Indirect Traditional Livelihoods or Customer Rights Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-livelihoods"
    },
    "srp-rep-direct-productivity-partners": {
      label: "Direct Increased Productivity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-productivity"
    },
    "srp-rep-indirect-productivity-partners": {
      label: "Indirect Increased Productivity Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-productivity"
    },
    "srp-rep-direct-other-partners": {
      label: "Direct Other Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "direct-other"
    },
    "srp-rep-indirect-other-partners": {
      label: "Indirect Other Restoration Partners",
      resource: "demographics",
      inputType: "restorationPartners",
      collection: "indirect-other"
    }
  }
};
