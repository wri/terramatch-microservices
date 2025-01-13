import { FactoryGirl } from "factory-girl-ts";
import { Nursery } from "../entities";
import { ProjectFactory } from "./project.factory";
import { faker } from "@faker-js/faker";
import { ENTITY_STATUSES, UPDATE_REQUEST_STATUSES } from "../constants/status";

export const NurseryFactory = FactoryGirl.define(Nursery, async () => ({
  uuid: crypto.randomUUID(),
  projectId: ProjectFactory.associate("id"),
  name: faker.animal.petName(),
  status: faker.helpers.arrayElement(ENTITY_STATUSES),
  updateRequestStatus: faker.helpers.arrayElement(UPDATE_REQUEST_STATUSES)
}));
