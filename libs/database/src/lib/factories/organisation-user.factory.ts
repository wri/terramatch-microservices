import { OrganisationUser } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { ORGANISATION_STATUSES } from "../constants/status";

export const OrganisationUserFactory = FactoryGirl.define(OrganisationUser, async () => ({
  status: faker.helpers.arrayElement(ORGANISATION_STATUSES)
}));
