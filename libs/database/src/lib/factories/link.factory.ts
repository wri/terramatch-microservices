import { FactoryGirl } from "factory-girl-ts";
import { AboutSection, Link } from "../entities";
import { faker } from "@faker-js/faker";
import { AboutSectionFactory } from "./about-section.factory";

export const LinkFactory = {
  section: (section?: AboutSection) =>
    FactoryGirl.define(Link, async () => ({
      order: faker.number.int({ min: 1, max: 10 }),
      linkableType: AboutSection.LARAVEL_TYPE,
      linkableId: (section?.id as number) ?? AboutSectionFactory.associate("id"),
      title: faker.lorem.sentence(),
      url: faker.internet.url()
    }))
};
