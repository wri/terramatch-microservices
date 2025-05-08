import { Organisation } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { ORGANISATION_STATUSES } from "../constants/status";
import { fakerCountries, fakerStates } from "../util/gadm-mock-data";

export const OrganisationFactory = FactoryGirl.define(Organisation, async () => {
  const countries = fakerCountries(2);
  const hqCountry = faker.helpers.arrayElement(countries);
  const states = fakerStates(countries, 5);

  return {
    status: faker.helpers.arrayElement(ORGANISATION_STATUSES),
    type: "non-profit-organisation",
    name: faker.company.name(),
    hqCountry,
    countries,
    states
  };
});
