import { FactoryGirl } from "factory-girl-ts";
import { I18nTranslation } from "../entities";
import { faker } from "@faker-js/faker";
import { I18nItemFactory } from "./i18n-item.factory";

export const I18nTranslationFactory = FactoryGirl.define(I18nTranslation, async () => ({
  i18nItemId: I18nItemFactory.associate("id"),
  language: "en-US",
  shortValue: faker.lorem.word(4),
  longValue: faker.lorem.sentence()
}));
