import { FactoryGirl } from "factory-girl-ts";
import { ImpactStory } from "../entities";
import { faker } from "@faker-js/faker";
import { OrganisationFactory } from "./organisation.factory";

export const ImpactStoryFactory = FactoryGirl.define(ImpactStory, async () => ({
  title: faker.lorem.slug(),
  status: faker.helpers.arrayElement(["draft", "published"]),
  organizationId: OrganisationFactory.associate("id"),
  date: faker.date.past().toISOString(),
  category: JSON.stringify({
    key: faker.lorem.slug(),
    value: faker.animal.bird()
  }),
  thumbnail: faker.image.avatar(),
  content: faker.lorem.paragraph()
}));
