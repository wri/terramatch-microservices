import { FactoryGirl } from "factory-girl-ts";
import { FundingType } from "../entities";
import { faker } from "@faker-js/faker";
import { OrganisationFactory } from "./organisation.factory";

export const FundingTypeFactory = FactoryGirl.define(FundingType, async () => ({
  source: faker.company.name(),
  amount: faker.number.int({ min: 1000, max: 1000000 }),
  year: faker.number.int({ min: 2020, max: 2025 }),
  type: faker.helpers.arrayElement(["grant", "loan", "investment", "donation"]),
  organisationId: OrganisationFactory.associate("uuid")
}));
