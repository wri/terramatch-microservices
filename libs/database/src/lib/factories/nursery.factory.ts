import { FactoryGirl } from "factory-girl-ts";
import { Nursery } from "../entities";
import { ProjectFactory } from "./project.factory";
import { faker } from "@faker-js/faker";
import { UPDATE_REQUEST_STATUSES } from "../constants/status";

export const NurseryFactory = FactoryGirl.define(Nursery, async () => ({
  projectId: ProjectFactory.associate("id"),
  name: faker.animal.petName(),
  updateRequestStatus: faker.helpers.arrayElement(UPDATE_REQUEST_STATUSES)
}));
