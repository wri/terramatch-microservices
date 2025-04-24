import { FactoryGirl } from "factory-girl-ts";
import { Project } from "../entities";
import { faker } from "@faker-js/faker";
import { UPDATE_REQUEST_STATUSES } from "../constants/status";
import { ApplicationFactory } from "./application.factory";
import { OrganisationFactory } from "./organisation.factory";
import { FRAMEWORK_KEYS } from "../constants/framework";

const CONTINENTS = ["africa", "australia", "south-america", "asia", "north-america"];

export const ProjectFactory = FactoryGirl.define(Project, async () => ({
  name: faker.animal.petName(),
  frameworkKey: faker.helpers.arrayElement(FRAMEWORK_KEYS),
  updateRequestStatus: faker.helpers.arrayElement(UPDATE_REQUEST_STATUSES),
  applicationId: ApplicationFactory.associate("id"),
  organisationId: OrganisationFactory.associate("id"),
  continent: faker.helpers.arrayElement(CONTINENTS),
  survivalRate: faker.number.int({ min: 20, max: 80 })
}));
