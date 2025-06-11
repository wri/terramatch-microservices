import { FactoryGirl } from "factory-girl-ts";
import { FormSection } from "../entities";
import { faker } from "@faker-js/faker";
import { FormFactory } from "./form.factory";

export const FormSectionFactory = FactoryGirl.define(FormSection, async () => ({
  formId: FormFactory.associate("uuid"),
  order: faker.number.int({ min: 1, max: 10 }),
  title: faker.lorem.words(3),
  subtitle: faker.lorem.sentence(),
  description: faker.lorem.paragraph()
}));
