import { FactoryGirl } from "factory-girl-ts";
import { FinancialReport, FundingType, Organisation } from "../entities";
import { faker } from "@faker-js/faker";
import { OrganisationFactory } from "./organisation.factory";
import { FinancialReportFactory } from "./financial-report.factory";

const defaultAttributesFactory = async () => ({
  source: faker.company.name(),
  amount: faker.number.int({ min: 1000, max: 1000000 }),
  year: faker.number.int({ min: 2020, max: 2025 }),
  type: faker.helpers.arrayElement(["grant", "loan", "investment", "donation"])
});

export const FundingTypeFactory = {
  org: (org?: Organisation) =>
    FactoryGirl.define(FundingType, async () => ({
      ...(await defaultAttributesFactory()),
      organisationId: (org?.uuid as string) ?? OrganisationFactory.associate("uuid")
    })),

  report: (report?: FinancialReport, org?: Organisation) =>
    FactoryGirl.define(FundingType, async () => {
      // ensure the report and funding type have the same org
      report ??= await FinancialReportFactory.org().create();
      const orgUuid = org?.uuid ?? (await Organisation.findByPk(report.organisationId))?.uuid;
      return {
        ...(await defaultAttributesFactory()),
        financialReportId: report.id as number,
        organisationId: orgUuid
      };
    })
};
