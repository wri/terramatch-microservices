import { IndicatorOutputFieldMonitoring } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { faker } from "@faker-js/faker";
import { SitePolygonFactory } from "./site-polygon.factory";

export const IndicatorOutputFieldMonitoringFactory = FactoryGirl.define(IndicatorOutputFieldMonitoring, async () => ({
  sitePolygonId: SitePolygonFactory.associate("id"),
  indicatorSlug: "fieldMonitoring",
  yearOfAnalysis: faker.date.past({ years: 5 }).getFullYear(),
  treeCount: faker.number.int({ min: 10, max: 10000 }),
  projectPhase: "Baseline",
  species: "Adansonia",
  survivalRate: faker.number.int({ min: 30, max: 90 })
}));
