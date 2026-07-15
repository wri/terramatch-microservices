import { FactoryGirl } from "factory-girl-ts";
import { AboutSection } from "../entities";
import { I18nItemFactory } from "./i18n-item.factory";
import { faker } from "@faker-js/faker";
import { ABOUT_SECTION_TYPES } from "../entities/about-section.entity";

export const AboutSectionFactory = FactoryGirl.define(AboutSection, async () => ({
  type: faker.helpers.arrayElement(ABOUT_SECTION_TYPES),
  headerId: I18nItemFactory.associate("id"),
  descriptionId: I18nItemFactory.associate("id"),
  contactSupportMessageId: I18nItemFactory.associate("id"),
  contactSupportSubjectId: I18nItemFactory.associate("id")
}));
