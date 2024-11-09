import { IndicatorOutputMsuCarbon } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { SitePolygonFactory } from "./site-polygon.factory";

export const IndicatorOutputMsuCarbonFactory = FactoryGirl.define(IndicatorOutputMsuCarbon, async () => ({
  sitePolygonId: SitePolygonFactory.associate("id"),
  indicatorSlug: "msuCarbon",
  yearOfAnalysis: faker.date.past({ years: 5 }).getFullYear(),
  carbonOutput: faker.number.float({ min: 0.2, max: 0.4 }),
  projectPhase: "Baseline",
  confidence: faker.number.float({ min: 30, max: 60 })
}));
