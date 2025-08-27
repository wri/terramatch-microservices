import { LinkedFieldConfiguration } from "../types";
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
      resource: "App\\Http\\Resources\\V2\\FinancialIndicatorsResource",
      inputType: "financialIndicators"
    },
    "fin-rep-funding-types": {
      property: "fundingTypes",
      label: "Funding Type",
      resource: "App\\Http\\Resources\\V2\\FundingTypeResource",
      inputType: "fundingType"
    }
  }
};
