import { FactoryGirl } from "factory-girl-ts";
import { Seeding, SiteReport } from "../entities";
import { faker } from "@faker-js/faker";
import { SiteReportFactory } from "./site-report.factory";

const defaultAttributesFactory = async () => ({
  uuid: crypto.randomUUID(),
  name: faker.lorem.words(2),
  amount: faker.number.int({ min: 10, max: 1000 }),
  hidden: false
});

export const SeedingFactory = {
  forSiteReport: FactoryGirl.define(Seeding, async () => ({
    ...(await defaultAttributesFactory()),
    seedableType: SiteReport.LARAVEL_TYPE,
    seedableId: SiteReportFactory.associate("id")
  }))
};
