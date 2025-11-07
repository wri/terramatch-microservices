import { FactoryGirl } from "factory-girl-ts";
import { FormTableHeader } from "../entities";
import { faker } from "@faker-js/faker";
import { FormQuestionFactory } from "./form-question.factory";

export const FormTableHeaderFactory = FactoryGirl.define(FormTableHeader, async () => ({
  formQuestionId: FormQuestionFactory.associate("id"),
  order: faker.number.int({ min: 1, max: 10 }),
  slug: faker.lorem.slug(),
  label: faker.lorem.word()
}));
