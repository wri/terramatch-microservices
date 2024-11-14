import { IndicatorOutputTreeCount } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { SitePolygonFactory } from "./site-polygon.factory";

const SLUGS = ["treeCount", "earlyTreeVerification"];

export const IndicatorOutputTreeCountFactory = FactoryGirl.define(IndicatorOutputTreeCount, async () => ({
  sitePolygonId: SitePolygonFactory.associate("id"),
  indicatorSlug: faker.helpers.arrayElement(SLUGS),
  yearOfAnalysis: faker.date.past({ years: 5 }).getFullYear(),
  surveyType: "Remote Sensing",
  surveyId: faker.number.int({ min: 100, max: 900 }),
  treeCount: faker.number.int({ min: 1, max: 10000 }),
  uncertaintyType: "foo", // TBD
  imagerySource: "Maxar",
  imageryId: faker.internet.url(),
  collectionDate: faker.date.past({ years: 5 }),
  projectPhase: "Midpoint",
  confidence: faker.number.float({ min: 30, max: 60 })
}));
