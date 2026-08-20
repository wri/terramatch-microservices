import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { PolygonAttributeDefinition, PolygonAttributeDefinitionOption } from "../entities";
import { PolygonAttributeDefinitionFactory } from "./polygon-attribute-definition.factory";

export const PolygonAttributeDefinitionOptionFactory = {
  definition: (definition?: PolygonAttributeDefinition) =>
    FactoryGirl.define(PolygonAttributeDefinitionOption, async () => ({
      polygonAttributeDefinitionId: (definition?.id as number) ?? PolygonAttributeDefinitionFactory.associate("id"),
      value: faker.lorem.slug(),
      label: faker.lorem.words({ min: 1, max: 3 }),
      order: faker.number.int({ min: 1, max: 20 })
    }))
};
