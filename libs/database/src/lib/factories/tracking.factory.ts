import { FactoryGirl } from "factory-girl-ts";
import { Tracking, Organisation, Project, ProjectPitch, ProjectReport, Site, SiteReport } from "../entities";
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
import { SiteFactory } from "./site.factory";

const defaultAttributesFactory = async () => ({
  description: null,
  hidden: false
});

export const TrackingFactory = {
  projectReport: (report?: ProjectReport) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: ProjectReport.LARAVEL_TYPE,
      trackableId: (report?.id as number) ?? ProjectReportFactory.associate("id"),
      domain: "demographics"
    })),

  projectReportWorkday: (report?: ProjectReport) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: ProjectReport.LARAVEL_TYPE,
      trackableId: (report?.id as number) ?? ProjectReportFactory.associate("id"),
      domain: "demographics",
      type: Tracking.WORKDAYS_TYPE,
      collection: faker.helpers.arrayElement(WORKDAYS_PROJECT_COLLECTIONS)
    })),

  siteWorkday: (site?: Site) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: Site.LARAVEL_TYPE,
      trackableId: (site?.id as number) ?? SiteFactory.associate("id"),
      domain: "demographics",
      type: Tracking.WORKDAYS_TYPE,
      collection: faker.helpers.arrayElement(WORKDAYS_SITE_COLLECTIONS)
    })),

  siteReportWorkday: (report?: SiteReport) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: SiteReport.LARAVEL_TYPE,
      trackableId: (report?.id as number) ?? SiteReportFactory.associate("id"),
      domain: "demographics",
      type: Tracking.WORKDAYS_TYPE,
      collection: faker.helpers.arrayElement(WORKDAYS_SITE_COLLECTIONS)
    })),

  projectReportRestorationPartner: (report?: ProjectReport) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: ProjectReport.LARAVEL_TYPE,
      trackableId: (report?.id as number) ?? ProjectReportFactory.associate("id"),
      domain: "demographics",
      type: Tracking.RESTORATION_PARTNERS_TYPE,
      collection: faker.helpers.arrayElement(RESTORATION_PARTNERS_PROJECT_COLLECTIONS)
    })),

  projectReportJobs: (report?: ProjectReport) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: ProjectReport.LARAVEL_TYPE,
      trackableId: (report?.id as number) ?? ProjectReportFactory.associate("id"),
      domain: "demographics",
      type: Tracking.JOBS_TYPE,
      collection: faker.helpers.arrayElement(JOBS_PROJECT_COLLECTIONS)
    })),

  organisationBeneficiaries: (org?: Organisation) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: Organisation.LARAVEL_TYPE,
      trackableId: (org?.id as number) ?? OrganisationFactory.associate("id"),
      domain: "demographics",
      type: Tracking.ALL_BENEFICIARIES_TYPE,
      collection: faker.helpers.arrayElement(ALL_BENEFICIARIES_ORGANISATION_COLLECTIONS)
    })),

  projectPitch: (pitch?: ProjectPitch) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: ProjectPitch.LARAVEL_TYPE,
      trackableId: (pitch?.id as number) ?? ProjectPitchFactory.associate("id"),
      domain: "demographics",
      type: Tracking.JOBS_TYPE,
      collection: faker.helpers.arrayElement(JOBS_PROJECT_COLLECTIONS)
    })),

  projectPitchAllEmployees: (pitch?: ProjectPitch) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: ProjectPitch.LARAVEL_TYPE,
      trackableId: (pitch?.id as number) ?? ProjectPitchFactory.associate("id"),
      domain: "demographics",
      type: Tracking.EMPLOYEES_TYPE,
      collection: ALL
    })),

  projectAllEmployees: (project?: Project) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: Project.LARAVEL_TYPE,
      trackableId: (project?.id as number) ?? ProjectFactory.associate("id"),
      domain: "demographics",
      type: Tracking.EMPLOYEES_TYPE,
      collection: ALL
    })),

  projectHectaresGoal: (project?: Project) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: Project.LARAVEL_TYPE,
      trackableId: (project?.id as number) ?? ProjectFactory.associate("id"),
      domain: "restoration",
      type: Tracking.HECTARES_GOAL_TYPE,
      collection: ALL
    })),

  projectTreesGoal: (project?: Project) =>
    FactoryGirl.define(Tracking, async () => ({
      ...(await defaultAttributesFactory()),
      trackableType: Project.LARAVEL_TYPE,
      trackableId: (project?.id as number) ?? ProjectFactory.associate("id"),
      domain: "restoration",
      type: Tracking.TREES_GOAL_TYPE,
      collection: ALL
    }))
};
