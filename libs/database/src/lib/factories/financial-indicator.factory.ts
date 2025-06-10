import { FinancialIndicator } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { OrganisationFactory } from "./organisation.factory";

export const FinancialIndicatorFactory = FactoryGirl.define(FinancialIndicator, async () => ({
  organisationId: OrganisationFactory.associate("id"),
  collection: faker.helpers.arrayElement(["revenue", "profit", "cost"])
}));
