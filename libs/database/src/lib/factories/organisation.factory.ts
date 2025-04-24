import { Organisation } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { ORGANISATION_STATUSES } from "../constants/status";

export const OrganisationFactory = FactoryGirl.define(Organisation, async () => ({
  status: faker.helpers.arrayElement(ORGANISATION_STATUSES),
  type: "non-profit-organisation",
  name: faker.company.name()
}));
