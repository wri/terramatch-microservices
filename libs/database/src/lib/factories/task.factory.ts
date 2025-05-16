import { FactoryGirl } from "factory-girl-ts";
import { Task } from "../entities";
import { faker } from "@faker-js/faker";
import { ProjectFactory } from "./project.factory";
import { DUE } from "../constants/status";
import { OrganisationFactory } from "./organisation.factory";

export const TaskFactory = FactoryGirl.define(Task, async () => {
  const dueAt = faker.date.past({ years: 2 });
  dueAt.setMilliseconds(0);
  return {
    projectId: ProjectFactory.associate("id"),
    organisationId: OrganisationFactory.associate("id"),
    status: DUE,
    dueAt
  };
});
