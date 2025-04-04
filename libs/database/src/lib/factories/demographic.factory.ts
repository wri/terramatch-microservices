import { FactoryGirl } from "factory-girl-ts";
import { Demographic, Organisation, Project, ProjectPitch, ProjectReport, SiteReport } from "../entities";
import { ProjectReportFactory } from "./project-report.factory";
import { SiteReportFactory } from "./site-report.factory";
import { faker } from "@faker-js/faker";
import {
  ALL,
  ALL_BENEFICIARIES_ORGANISATION_COLLECTIONS,
  JOBS_PROJECT_COLLECTIONS,
  RESTORATION_PARTNERS_PROJECT_COLLECTIONS,
  WORKDAYS_PROJECT_COLLECTIONS,
  WORKDAYS_SITE_COLLECTIONS
} from "../constants/demographic-collections";
import { OrganisationFactory } from "./organisation.factory";
import { ProjectPitchFactory } from "./project-pitch.factory";
import { ProjectFactory } from "./project.factory";

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
    type: Demographic.WORKDAYS_TYPE,
    collection: faker.helpers.arrayElement(WORKDAYS_PROJECT_COLLECTIONS)
  })),

  forSiteReportWorkday: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: SiteReport.LARAVEL_TYPE,
    demographicalId: SiteReportFactory.associate("id"),
    type: Demographic.WORKDAYS_TYPE,
    collection: faker.helpers.arrayElement(WORKDAYS_SITE_COLLECTIONS)
  })),

  forProjectReportRestorationPartner: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: ProjectReport.LARAVEL_TYPE,
    demographicalId: ProjectReportFactory.associate("id"),
    type: Demographic.RESTORATION_PARTNERS_TYPE,
    collection: faker.helpers.arrayElement(RESTORATION_PARTNERS_PROJECT_COLLECTIONS)
  })),

  forProjectReportJobs: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: ProjectReport.LARAVEL_TYPE,
    demographicalId: ProjectReportFactory.associate("id"),
    type: Demographic.JOBS_TYPE,
    collection: faker.helpers.arrayElement(JOBS_PROJECT_COLLECTIONS)
  })),

  forOrganisationBeneficiaries: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: Organisation.LARAVEL_TYPE,
    demographicalId: OrganisationFactory.associate("id"),
    type: Demographic.ALL_BENEFICIARIES_TYPE,
    collection: faker.helpers.arrayElement(ALL_BENEFICIARIES_ORGANISATION_COLLECTIONS)
  })),

  forProjectPitchAllEmployees: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: ProjectPitch.LARAVEL_TYPE,
    demographicalId: ProjectPitchFactory.associate("id"),
    type: Demographic.EMPLOYEES_TYPE,
    collection: ALL
  })),

  forProjectAllEmployees: FactoryGirl.define(Demographic, async () => ({
    ...(await defaultAttributesFactory()),
    demographicalType: Project.LARAVEL_TYPE,
    demographicalId: ProjectFactory.associate("id"),
    type: Demographic.EMPLOYEES_TYPE,
    collection: ALL
  }))
};
