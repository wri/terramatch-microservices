import { FactoryGirl } from "factory-girl-ts";
import { I18nItem } from "../entities";
import { faker } from "@faker-js/faker";

export const I18nItemFactory = FactoryGirl.define(I18nItem, async () => ({
  status: "translated",
  type: "short",
  shortValue: faker.lorem.word(4),
  hash: faker.lorem.word(4)
}));
