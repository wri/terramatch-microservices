import { FactoryGirl } from "factory-girl-ts";
import { Disturbance, Site, SiteReport } from "../entities";
import { faker } from "@faker-js/faker";
import { SiteFactory } from "./site.factory";

const TYPES = ["manmade", "climatic", "ecological"];
const INTENSITIES = ["low", "medium", "high"];

const defaultAttributesFactory = async () => ({
  disturbanceDate: faker.date.past(),
  type: faker.helpers.arrayElement(TYPES),
  intensity: faker.helpers.arrayElement(INTENSITIES),
  peopleAffected: faker.number.int({ min: 1, max: 100 }),
  description: faker.lorem.sentence()
});

export const DisturbanceFactory = {
  site: (site?: Site) =>
    FactoryGirl.define(Disturbance, async () => ({
      ...(await defaultAttributesFactory()),
      disturbanceableType: Site.LARAVEL_TYPE,
      disturbanceableId: (site?.id as number) ?? SiteFactory.associate("id")
    })),

  siteReport: (report?: SiteReport) =>
    FactoryGirl.define(Disturbance, async () => ({
      ...(await defaultAttributesFactory()),
      disturbanceableType: SiteReport.LARAVEL_TYPE,
      disturbanceableId: (report?.id as number) ?? SiteFactory.associate("id")
    }))
};
