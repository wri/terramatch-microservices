import { FormOptionListOption } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";

export const FormOptionListOptionFactory = FactoryGirl.define(FormOptionListOption, async () => ({
  slug: faker.lorem.slug(),
  label: faker.lorem.word()
}));
