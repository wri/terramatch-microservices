import { FactoryGirl } from "factory-girl-ts";
import { FormQuestion, FormQuestionOption } from "../entities";
import { faker } from "@faker-js/faker";
import { FormQuestionFactory } from "./form-question.factory";

export const FormQuestionOptionFactory = {
  forQuestion: (formQuestion?: FormQuestion) =>
    FactoryGirl.define(FormQuestionOption, async () => ({
      formQuestionId: formQuestion?.id ?? FormQuestionFactory.section().associate("id"),
      order: faker.number.int({ min: 1, max: 10 }),
      slug: faker.lorem.slug(),
      label: faker.lorem.word(),
      imageUrl: faker.image.url()
    }))
};
