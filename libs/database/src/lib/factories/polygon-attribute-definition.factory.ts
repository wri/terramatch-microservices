import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { FRAMEWORK_KEYS } from "../constants";
import { PolygonAttributeDefinition } from "../entities";
import { POLYGON_ATTRIBUTE_INPUT_TYPES } from "../entities/polygon-attribute-definition.entity";

export const PolygonAttributeDefinitionFactory = FactoryGirl.define(PolygonAttributeDefinition, async () => ({
  key: faker.lorem.slug(),
  label: faker.lorem.words({ min: 2, max: 4 }),
  inputType: faker.helpers.arrayElement(POLYGON_ATTRIBUTE_INPUT_TYPES),
  frameworkKey: faker.helpers.arrayElement(FRAMEWORK_KEYS),
  isRequired: false,
  isActive: true
}));
