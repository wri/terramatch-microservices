import { FactoryGirl } from "factory-girl-ts";
import { FormQuestionOption } from "../entities";
import { faker } from "@faker-js/faker";
import { FormQuestionFactory } from "./form-question.factory";

export const FormQuestionOptionFactory = FactoryGirl.define(FormQuestionOption, async () => ({
  formQuestionId: FormQuestionFactory.associate("id"),
  order: faker.number.int({ min: 1, max: 10 }),
  slug: faker.lorem.slug(),
  label: faker.lorem.word(),
  imageUrl: faker.image.url()
}));
