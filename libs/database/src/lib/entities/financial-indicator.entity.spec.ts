import { FinancialIndicator } from "./financial-indicator.entity";

describe("FinancialIndicator", () => {
  let financialIndicator: FinancialIndicator;

  beforeEach(() => {
    financialIndicator = new FinancialIndicator();
    financialIndicator.id = 1;
    financialIndicator.uuid = "indicator-uuid-1";
    financialIndicator.organisationId = 1;
    financialIndicator.year = 2023;
    financialIndicator.collection = "test-collection";
    financialIndicator.amount = 1000.5;
    financialIndicator.description = "Test financial indicator description";
    financialIndicator.exchangeRate = 1.25;
    financialIndicator.createdAt = new Date();
    financialIndicator.updatedAt = new Date();
  });
});
