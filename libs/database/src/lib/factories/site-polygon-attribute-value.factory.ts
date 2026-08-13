import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { PolygonAttributeDefinition, SitePolygonAttributeValue } from "../entities";
import { PolygonAttributeDefinitionFactory } from "./polygon-attribute-definition.factory";
import { SitePolygonFactory } from "./site-polygon.factory";

export const SitePolygonAttributeValueFactory = {
  forDefinition: (definition?: PolygonAttributeDefinition) =>
    FactoryGirl.define(SitePolygonAttributeValue, async () => ({
      sitePolygonUuid: SitePolygonFactory.associate("uuid"),
      polygonAttributeDefinitionId: (definition?.id as number) ?? PolygonAttributeDefinitionFactory.associate("id"),
      value: faker.lorem.slug()
    }))
};
