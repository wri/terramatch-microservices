import { Audit, FormSubmission, Project } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { ProjectFactory } from "./project.factory";
import { faker } from "@faker-js/faker";
import { FormSubmissionFactory } from "./form-submission.factory";

const defaultAttributesFactory = async () => ({
  event: faker.helpers.arrayElement(["created", "updated", "deleted"]),
  oldValues: {},
  newValues: {}
});

export const AuditFactory = {
  project: (project?: Project) =>
    FactoryGirl.define(Audit, async () => ({
      ...(await defaultAttributesFactory()),
      auditableType: Project.LARAVEL_TYPE,
      auditableId: (project?.id as number) ?? ProjectFactory.associate("id")
    })),

  formSubmission: (fs?: FormSubmission) =>
    FactoryGirl.define(Audit, async () => ({
      ...(await defaultAttributesFactory()),
      auditableType: FormSubmission.LARAVEL_TYPE,
      auditableId: (fs?.id as number) ?? FormSubmissionFactory.associate("id")
    }))
};
