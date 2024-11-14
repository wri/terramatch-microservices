import { IndicatorOutputTreeCoverLoss } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { SitePolygonFactory } from "./site-polygon.factory";

const SLUGS = ["treeCoverLoss", "treeCoverLossFires"];

export const IndicatorOutputTreeCoverLossFactory = FactoryGirl.define(IndicatorOutputTreeCoverLoss, async () => ({
  sitePolygonId: SitePolygonFactory.associate("id"),
  indicatorSlug: faker.helpers.arrayElement(SLUGS),
  yearOfAnalysis: faker.date.past({ years: 5 }).getFullYear(),
  value: { [faker.date.past({ years: 5 }).getFullYear()]: faker.number.float({ min: 0.1, max: 0.3 }) }
}));
