import { FactoryGirl } from "factory-girl-ts";
import { FinancialReport } from "../entities";
import { faker } from "@faker-js/faker";
import { OrganisationFactory } from "./organisation.factory";
import { UserFactory } from "./user.factory";

export const FinancialReportFactory = FactoryGirl.define(FinancialReport, async () => ({
  title: faker.lorem.slug(),
  yearOfReport: faker.number.int({ min: 2020, max: 2025 }),
  status: "started",
  organisationId: OrganisationFactory.associate("id"),
  createdBy: UserFactory.associate("id"),
  approvedBy: UserFactory.associate("id"),
  frameworkKey: "test",
  completion: 0
}));
