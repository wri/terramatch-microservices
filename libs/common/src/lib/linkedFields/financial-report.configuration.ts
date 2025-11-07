import { LinkedFieldConfiguration } from "@terramatch-microservices/database/constants/linked-fields";
import { FinancialReport } from "@terramatch-microservices/database/entities";

// Note: All field / fileCollection / relation keys _must_ be unique across all LinkedFieldConfigurations.
export const FinancialReportConfiguration: LinkedFieldConfiguration = {
  label: "Financial Report",
  laravelModelType: FinancialReport.LARAVEL_TYPE,
  fields: {},
  fileCollections: {},
  relations: {
    "fin-rep-financial-indicators-financial-collection": {
      property: "financialCollection",
      label: "Financial collection",
      resource: "financialIndicators",
      inputType: "financialIndicators"
    },
    "fin-rep-funding-types": {
      property: "fundingTypes",
      label: "Funding Type",
      resource: "fundingTypes",
      inputType: "fundingType"
    }
  }
};
