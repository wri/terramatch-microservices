import { FactoryGirl } from "factory-girl-ts";
import { ProjectReport, SiteReport, Demographic } from "../entities";
import { ProjectReportFactory } from "./project-report.factory";
import { SiteReportFactory } from "./site-report.factory";
import { faker } from "@faker-js/faker";

const defaultAttributesFactory = async () => ({
  uuid: crypto.randomUUID(),
  description: null,
  hidden: false
});

export const DemographicFactory = {
  forProjectReportWorkday: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: ProjectReport.LARAVEL_TYPE,
    demographicalId: ProjectReportFactory.associate("id"),
    type: "workdays",
    collection: faker.helpers.arrayElement(ProjectReport.WORKDAY_COLLECTIONS)
  })),

  forSiteReportWorkday: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: SiteReport.LARAVEL_TYPE,
    demographicalId: SiteReportFactory.associate("id"),
    type: "workdays",
    collection: faker.helpers.arrayElement(SiteReport.WORKDAY_COLLECTIONS)
  })),

  forProjectReportRestorationPartner: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: ProjectReport.LARAVEL_TYPE,
    demographicalId: ProjectReportFactory.associate("id"),
    type: "restoration-partners",
    collection: faker.helpers.arrayElement(ProjectReport.RESTORATION_PARTNER_COLLECTIONS)
  }))
};
