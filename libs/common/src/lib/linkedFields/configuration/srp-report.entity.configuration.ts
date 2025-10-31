import { LinkedFieldConfiguration } from "../types";
import { SrpReport } from "@terramatch-microservices/database/entities";

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
    "srp-direct-income-partners": {
      property: "restorationPartnersDirectIncome",
      label: "Direct Income Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-income"
    },
    "srp-indirect-income-partners": {
      property: "restorationPartnersIndirectIncome",
      label: "Indirect Income Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-income"
    },
    "srp-direct-benefits-partners": {
      property: "restorationPartnersDirectBenefits",
      label: "Direct In-kind Benefits Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-benefits"
    },
    "srp-indirect-benefits-partners": {
      property: "restorationPartnersIndirectBenefits",
      label: "Indirect In-kind Benefits Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-benefits"
    },
    "srp-direct-conservation-payments-partners": {
      property: "restorationPartnersDirectConservationPayments",
      label: "Direct Conservation Agreement Payment Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-conservation-payments"
    },
    "srp-indirect-conservation-payments-partners": {
      property: "restorationPartnersIndirectConservationPayments",
      label: "Indirect Conservation Agreement Payment Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-conservation-payments"
    },
    "srp-direct-market-access-partners": {
      property: "restorationPartnersDirectMarketAccess",
      label: "Direct Increased Market Access Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-market-access"
    },
    "srp-indirect-market-access-partners": {
      property: "restorationPartnersIndirectMarketAccess",
      label: "Indirect Increased Market Access Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-market-access"
    },
    "srp-direct-capacity-partners": {
      property: "restorationPartnersDirectCapacity",
      label: "Direct Increased Capacity Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-capacity"
    },
    "srp-indirect-capacity-partners": {
      property: "restorationPartnersIndirectCapacity",
      label: "Indirect Capacity Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-capacity"
    },
    "srp-direct-training-partners": {
      property: "restorationPartnersDirectTraining",
      label: "Direct Training Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-training"
    },
    "srp-indirect-training-partners": {
      property: "restorationPartnersIndirectTraining",
      label: "Indirect Training Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-training"
    },
    "srp-direct-land-title-partners": {
      property: "restorationPartnersDirectLandTitle",
      label: "Direct Newly Secured Land Title Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-land-title"
    },
    "srp-indirect-land-title-partners": {
      property: "restorationPartnersIndirectLandTitle",
      label: "Indirect Newly Secured Land Title Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-land-title"
    },
    "srp-direct-livelihoods-partners": {
      property: "restorationPartnersDirectLivelihoods",
      label: "Direct Traditional Livelihoods or Customer Rights Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-livelihoods"
    },
    "srp-indirect-livelihoods-partners": {
      property: "restorationPartnersIndirectLivelihoods",
      label: "Indirect Traditional Livelihoods or Customer Rights Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-livelihoods"
    },
    "srp-direct-productivity-partners": {
      property: "restorationPartnersDirectProductivity",
      label: "Direct Increased Productivity Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-productivity"
    },
    "srp-indirect-productivity-partners": {
      property: "restorationPartnersIndirectProductivity",
      label: "Indirect Increased Productivity Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-productivity"
    },
    "srp-direct-other-partners": {
      property: "restorationPartnersDirectOther",
      label: "Direct Other Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "direct-other"
    },
    "srp-indirect-other-partners": {
      property: "restorationPartnersIndirectOther",
      label: "Indirect Other Restoration Partners",
      resource: "App\\Http\\Resources\\V2\\Demographics\\DemographicResource",
      inputType: "restorationPartners",
      collection: "indirect-other"
    }
  }
};
