import { IndicatorOutputHectares } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { SitePolygonFactory } from "./site-polygon.factory";

const SLUGS = ["restorationByEcoRegion", "restorationByStrategy", "restorationByLandUse"];
const TYPES = ["Direct-Seeding", "Agroforest", "Tree-Planting"];

export const IndicatorOutputHectaresFactory = FactoryGirl.define(IndicatorOutputHectares, async () => ({
  sitePolygonId: SitePolygonFactory.associate("id"),
  indicatorSlug: faker.helpers.arrayElement(SLUGS),
  yearOfAnalysis: faker.date.past({ years: 5 }).getFullYear(),
  value: { [faker.helpers.arrayElement(TYPES)]: faker.number.float({ min: 0.1, max: 0.5 }) }
}));
