import { FactoryGirl } from "factory-girl-ts";
import { FormQuestion } from "../entities";
import { faker } from "@faker-js/faker";

export const FormQuestionFactory = FactoryGirl.define(FormQuestion, async () => ({
  formSectionId: 1, // This will be overridden when needed
  inputType: "text",
  label: faker.lorem.sentence(),
  order: faker.number.int({ min: 1, max: 10 }),
  multiChoice: false,
  conditionalDefault: true,
  isParentConditionalDefault: false
}));
