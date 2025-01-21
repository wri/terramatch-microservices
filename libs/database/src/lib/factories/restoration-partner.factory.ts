import { FactoryGirl } from "factory-girl-ts";
import { ProjectReport, RestorationPartner } from "../entities";
import { ProjectReportFactory } from "./project-report.factory";
import { faker } from "@faker-js/faker";

const defaultAttributesFactory = async () => ({
  uuid: crypto.randomUUID(),
  description: null,
  hidden: false
});

export const RestorationPartnerFactory = {
  forProjectReport: FactoryGirl.define(RestorationPartner, async () => ({
    ...(await defaultAttributesFactory()),
    partnerableType: ProjectReport.LARAVEL_TYPE,
    partnerableId: ProjectReportFactory.associate("id"),
    collection: faker.helpers.arrayElement(ProjectReport.RESTORATION_PARTNER_COLLECTIONS)
  }))
};
