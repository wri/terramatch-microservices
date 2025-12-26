import { FactoryGirl } from "factory-girl-ts";
import { FinancialIndicator, FinancialReport, Organisation } from "../entities";
import { FinancialReportFactory, OrganisationFactory } from ".";
import { faker } from "@faker-js/faker";

const defaultAttributesFactory = async () => ({
  collection: faker.lorem.slug(),
  amount: faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
  description: faker.lorem.sentences()
});

export const FinancialIndicatorFactory = {
  org: (org?: Organisation) =>
    FactoryGirl.define(FinancialIndicator, async () => ({
      ...(await defaultAttributesFactory()),
      organisationId: (org?.id as number) ?? OrganisationFactory.associate("id")
    })),

  report: (financialReport?: FinancialReport) =>
    FactoryGirl.define(FinancialIndicator, async () => {
      // ensure the report and indicator have the same org
      financialReport ??= await FinancialReportFactory.org().create();
      return {
        ...(await defaultAttributesFactory()),
        financialReportId: financialReport.id as number,
        organisationId: financialReport.organisationId
      };
    })
};
