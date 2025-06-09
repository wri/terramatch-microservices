import { FactoryGirl } from "factory-girl-ts";
import { FormQuestion } from "../entities";
import { faker } from "@faker-js/faker";
import { FormSectionFactory } from "./form-section.factory";

export const FormQuestionFactory = FactoryGirl.define(FormQuestion, async () => ({
  formSectionId: FormSectionFactory.associate("id"),
  inputType: "text",
  label: faker.lorem.sentence(),
  order: faker.number.int({ min: 1, max: 10 }),
  multiChoice: false,
  conditionalDefault: true,
  isParentConditionalDefault: false
}));
