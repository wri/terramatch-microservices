import { FactoryGirl } from "factory-girl-ts";
import { AboutSection } from "../entities";
import { faker } from "@faker-js/faker";
import { ABOUT_SECTION_TYPES } from "../entities/about-section.entity";

export const AboutSectionFactory = FactoryGirl.define(AboutSection, async () => ({
  type: faker.helpers.arrayElement(ABOUT_SECTION_TYPES),
  header: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  contactSupportMessage: faker.lorem.sentence(),
  contactSupportSubject: faker.lorem.sentence()
}));
