import { FactoryGirl } from "factory-girl-ts";
import { Form, FormSection } from "../entities";
import { faker } from "@faker-js/faker";
import { FormFactory } from "./form.factory";

export const FormSectionFactory = {
  forForm: (form?: Form) =>
    FactoryGirl.define(FormSection, async () => ({
      formId: form?.uuid ?? FormFactory.associate("uuid"),
      order: faker.number.int({ min: 1, max: 10 }),
      title: faker.lorem.words(3),
      subtitle: faker.lorem.sentence(),
      description: faker.lorem.paragraph()
    }))
};
