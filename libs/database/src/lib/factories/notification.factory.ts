import { FactoryGirl } from "factory-girl-ts";
import { Notification } from "../entities";
import { faker } from "@faker-js/faker";
import { UserFactory } from "./user.factory";
import { ProjectFactory } from "./project.factory";

export const NotificationFactory = FactoryGirl.define(Notification, async () => ({
  userId: UserFactory.associate("id"),
  projectId: ProjectFactory.associate("id"),
  summary: faker.lorem.sentence(),
  category: "project-reporting"
}));
