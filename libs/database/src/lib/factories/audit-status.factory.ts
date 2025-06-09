import { AuditStatus } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { Project } from "../entities";
import { ProjectFactory } from "./project.factory";
import { faker } from "@faker-js/faker";

export const AuditStatusFactory = FactoryGirl.define(AuditStatus, async () => ({
  id: faker.number.int({ min: 1, max: 1000000 }),
  uuid: faker.string.uuid(),
  auditableType: Project.LARAVEL_TYPE,
  auditableId: ProjectFactory.associate("id"),
  status: faker.lorem.words(1),
  comment: faker.lorem.words(1),
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  type: faker.helpers.arrayElement([
    "change-request",
    "status",
    "submission",
    "comment",
    "change-request-updated",
    "reminder-sent"
  ]),
  isSubmitted: faker.datatype.boolean(),
  isActive: faker.datatype.boolean(),
  requestRemoved: faker.datatype.boolean(),
  dateCreated: faker.date.recent(),
  createdBy: faker.internet.email()
}));
