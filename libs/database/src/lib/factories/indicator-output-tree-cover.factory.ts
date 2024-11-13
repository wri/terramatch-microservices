import { IndicatorOutputTreeCover } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { SitePolygonFactory } from "./site-polygon.factory";

export const IndicatorOutputTreeCoverFactory = FactoryGirl.define(IndicatorOutputTreeCover, async () => ({
  sitePolygonId: SitePolygonFactory.associate("id"),
  indicatorSlug: "treeCover",
  yearOfAnalysis: faker.date.past({ years: 5 }).getFullYear(),
  percentCover: faker.number.int({ min: 30, max: 60 }),
  projectPhase: "Baseline",
  plusMinusPercent: faker.number.int({ min: 30, max: 60 })
}));
