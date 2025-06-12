import { FactoryGirl } from "factory-girl-ts";
import { FinancialIndicator } from "../entities";
import { OrganisationFactory } from ".";
import { faker } from "@faker-js/faker";

export const FinancialIndicatorFactory = FactoryGirl.define(FinancialIndicator, async () => ({
  organisationId: OrganisationFactory.associate("id"),
  collection: faker.lorem.slug(),
  amount: faker.number.float({ min: 100, max: 10000, fractionDigits: 2 }),
  description: faker.lorem.sentences()
}));
