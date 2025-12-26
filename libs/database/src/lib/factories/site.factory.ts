import { Site } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { ProjectFactory } from "./project.factory";
import { faker } from "@faker-js/faker";
import { UPDATE_REQUEST_STATUSES } from "../constants/status";
import { SITING_STRATEGIES } from "../constants/entity-selects";

export const SiteFactory = FactoryGirl.define(Site, async () => ({
  projectId: ProjectFactory.associate("id"),
  name: faker.animal.petName(),
  frameworkKey: "ppc",
  updateRequestStatus: faker.helpers.arrayElement(UPDATE_REQUEST_STATUSES),
  sitingStrategy: faker.helpers.arrayElement(SITING_STRATEGIES),
  descriptionSitingStrategy: faker.lorem.paragraph()
}));
