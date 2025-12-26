import { AuditStatus, FormSubmission } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { Project } from "../entities";
import { ProjectFactory } from "./project.factory";
import { faker } from "@faker-js/faker";
import { FormSubmissionFactory } from "./form-submission.factory";

const defaultAttributesFactory = async () => ({
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
});

export const AuditStatusFactory = {
  project: (project?: Project) =>
    FactoryGirl.define(AuditStatus, async () => ({
      ...(await defaultAttributesFactory()),
      auditableType: Project.LARAVEL_TYPE,
      auditableId: (project?.id as number) ?? ProjectFactory.associate("id")
    })),

  formSubmission: (fs?: FormSubmission) =>
    FactoryGirl.define(AuditStatus, async () => ({
      ...(await defaultAttributesFactory()),
      auditableType: FormSubmission.LARAVEL_TYPE,
      auditableId: (fs?.id as number) ?? FormSubmissionFactory.associate("id")
    }))
};
