import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { LocalizationKeyEntity } from "../entities";
import { I18nItemFactory } from "./i18n-item.factory";

export const LocalizationKeyFactory = FactoryGirl.define(LocalizationKeyEntity, async () => ({
  key: faker.lorem.word(),
  value: faker.lorem.sentence(),
  valueId: I18nItemFactory.associate("id")
}));
