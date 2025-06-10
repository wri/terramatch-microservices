import { FactoryGirl } from "factory-girl-ts";
import { Form } from "../entities";
import { faker } from "@faker-js/faker";
import { UserFactory } from "./user.factory";

export const FormFactory = FactoryGirl.define(Form, async () => ({
  frameworkKey: "ppc",
  model: "project",
  version: 1,
  type: "application",
  title: faker.lorem.words(3),
  subtitle: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  documentation: faker.lorem.paragraph(),
  submissionMessage: faker.lorem.sentence(),
  duration: 30,
  published: true,
  deadlineAt: faker.date.future(),
  updatedBy: UserFactory.associate("id")
}));
