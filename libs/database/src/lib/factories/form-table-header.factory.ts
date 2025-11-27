import { FactoryGirl } from "factory-girl-ts";
import { FormQuestion, FormTableHeader } from "../entities";
import { faker } from "@faker-js/faker";
import { FormQuestionFactory } from "./form-question.factory";

export const FormTableHeaderFactory = {
  forQuestion: (formQuestion?: FormQuestion) =>
    FactoryGirl.define(FormTableHeader, async () => ({
      formQuestionId: formQuestion?.id ?? FormQuestionFactory.forSection().associate("id"),
      order: faker.number.int({ min: 1, max: 10 }),
      slug: faker.lorem.slug(),
      label: faker.lorem.word()
    }))
};
