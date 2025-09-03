import { FactoryGirl } from "factory-girl-ts";
import { DisturbanceReport } from "../entities";
import { faker } from "@faker-js/faker";
import { ProjectFactory } from "./project.factory";
import { UserFactory } from "./user.factory";

export const DisturbanceReportFactory = FactoryGirl.define(DisturbanceReport, async () => ({
  title: faker.lorem.slug(),
  status: "started",
  projectId: ProjectFactory.associate("id"),
  createdBy: UserFactory.associate("id"),
  approvedBy: UserFactory.associate("id"),
  frameworkKey: "test",
  completion: 0
}));
