import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { FormOptionList } from "../entities";

export const FormOptionListFactory = FactoryGirl.define(FormOptionList, async () => ({
  key: faker.lorem.slug()
}));
