import { OrganisationJoinRequest } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { ORGANISATION_JOIN_REQUEST_STATUSES } from "../constants/status";

export const OrganisationJoinRequestFactory = FactoryGirl.define(OrganisationJoinRequest, async () => ({
  status: faker.helpers.arrayElement(ORGANISATION_JOIN_REQUEST_STATUSES)
}));
