import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { FRAMEWORK_KEYS } from "../constants";
import { POLYGON_ATTRIBUTE_INPUT_TYPES } from "../constants/polygon-attribute-input-types";
import { PolygonAttributeDefinition } from "../entities";

export const PolygonAttributeDefinitionFactory = FactoryGirl.define(PolygonAttributeDefinition, async () => ({
  key: faker.lorem.slug(),
  label: faker.lorem.words({ min: 2, max: 4 }),
  inputType: faker.helpers.arrayElement(POLYGON_ATTRIBUTE_INPUT_TYPES),
  frameworkKey: faker.helpers.arrayElement(FRAMEWORK_KEYS),
  isRequired: false,
  isActive: true
}));
