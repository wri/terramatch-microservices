import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { FinancialReport } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const FinancialReportConfiguration: LinkedFieldConfiguration<FinancialReport> = {
  label: "Financial Report",
  fields: {
    "fin-rep-currency": {
      property: "currency",
      label: "Local Currency",
      inputType: "select",
      multiChoice: false,
      optionListKey: "currencies"
    },
    "fin-rep-fin-start-month": {
      property: "finStartMonth",
      label: "Financial Start Month",
      inputType: "select",
      multiChoice: false,
      optionListKey: "months"
    }
  },
  fileCollections: {},
  relations: {
    "fin-rep-financial-indicators-financial-collection": {
      label: "Financial collection",
      exportHeading: "financialCollection",
      resource: "financialIndicators",
      inputType: "financialIndicators"
    },
    "fin-rep-funding-types": {
      label: "Funding Type",
      exportHeading: "fundingTypes",
      resource: "fundingTypes",
      inputType: "fundingType"
    }
  }
};
