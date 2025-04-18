import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { FormSubmission } from "../entities";
import { ApplicationFactory } from "./application.factory";
import { FORM_SUBMISSION_STATUSES } from "../constants/status";

export const FormSubmissionFactory = FactoryGirl.define(FormSubmission, async () => ({
  applicationId: ApplicationFactory.associate("id"),
  name: faker.animal.petName(),
  status: faker.helpers.arrayElement(FORM_SUBMISSION_STATUSES)
}));
