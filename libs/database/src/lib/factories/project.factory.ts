import { FactoryGirl } from "factory-girl-ts";
import { Project } from "../entities";
import { faker } from "@faker-js/faker";
import { ENTITY_STATUSES, UPDATE_REQUEST_STATUSES } from "../constants/status";
import { ApplicationFactory } from "./application.factory";
import { OrganisationFactory } from "./organisation.factory";
import { FRAMEWORK_KEYS } from "../constants/framework";

const CONTINENTS = ["africa", "australia", "south-america", "asia", "north-america"];

export const ProjectFactory = FactoryGirl.define(Project, async () => ({
  uuid: crypto.randomUUID(),
  name: faker.animal.petName(),
  frameworkKey: faker.helpers.arrayElement(FRAMEWORK_KEYS),
  status: faker.helpers.arrayElement(ENTITY_STATUSES),
  updateRequestStatus: faker.helpers.arrayElement(UPDATE_REQUEST_STATUSES),
  applicationId: ApplicationFactory.associate("id"),
  organisationId: OrganisationFactory.associate("id"),
  continent: faker.helpers.arrayElement(CONTINENTS),
  survivalRate: faker.number.int({ min: 20, max: 80 })
}));
