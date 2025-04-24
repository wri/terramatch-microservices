import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { LocalizationKey } from "../entities";
import { I18nItemFactory } from "./i18n-item.factory";

export const LocalizationKeyFactory = FactoryGirl.define(LocalizationKey, async () => ({
  key: faker.lorem.word(),
  value: faker.lorem.sentence(),
  valueId: I18nItemFactory.associate("id")
}));
