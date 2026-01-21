import { FactoryGirl } from "factory-girl-ts";
import { Framework } from "../entities";
import { faker } from "@faker-js/faker";
import { FrameworkKey } from "../constants";

export const FrameworkFactory = FactoryGirl.define(Framework, async () => {
  const slug = faker.lorem.slug(1) as FrameworkKey;
  return {
    slug,
    name: faker.lorem.word(),
    accessCode: slug
  };
});
