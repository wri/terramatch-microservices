import { FactoryGirl } from "factory-girl-ts";
import { FormQuestionOption } from "../entities";
import { faker } from "@faker-js/faker";
import { FormFactory } from "./form.factory";

export const FormQuestionOptionFactory = FactoryGirl.define(FormQuestionOption, async () => ({
  formQuestionId: FormFactory.associate("id"),
  order: faker.number.int({ min: 1, max: 10 }),
  label: faker.lorem.word(),
  imageUrl: faker.image.url()
}));
