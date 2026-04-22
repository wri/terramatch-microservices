import { FactoryGirl } from "factory-girl-ts";
import { Form, Nursery, NurseryReport, Project, ProjectReport, Site, SiteReport } from "../entities";
import { faker } from "@faker-js/faker";
import { UserFactory } from "./user.factory";

const defaultAttributesFactory = async () => ({
  frameworkKey: "ppc",
  model: Project.LARAVEL_TYPE,
  version: 1,
  type: "application",
  title: faker.lorem.words(3),
  subtitle: faker.lorem.sentence(),
  description: faker.lorem.paragraph(),
  documentation: faker.lorem.paragraph(),
  submissionMessage: faker.lorem.sentence(),
  duration: 30,
  published: true,
  deadlineAt: faker.date.future(),
  updatedBy: UserFactory.associate("id")
});

export const FormFactory = FactoryGirl.define(Form, async () => defaultAttributesFactory());

export const EntityFormFactory = {
  project: (project?: Project) =>
    FactoryGirl.define(Form, async () => ({
      ...(await defaultAttributesFactory()),
      frameworkKey: project?.frameworkKey ?? "ppc",
      model: Project.LARAVEL_TYPE,
      type: "project"
    })),

  site: (site?: Site) =>
    FactoryGirl.define(Form, async () => ({
      ...(await defaultAttributesFactory()),
      frameworkKey: site?.frameworkKey ?? "ppc",
      model: Site.LARAVEL_TYPE,
      type: "site"
    })),

  nursery: (nursery?: Nursery) =>
    FactoryGirl.define(Form, async () => ({
      ...(await defaultAttributesFactory()),
      frameworkKey: nursery?.frameworkKey ?? "ppc",
      model: Nursery.LARAVEL_TYPE,
      type: "nursery"
    })),

  projectReport: (report?: ProjectReport) =>
    FactoryGirl.define(Form, async () => ({
      ...(await defaultAttributesFactory()),
      frameworkKey: report?.frameworkKey ?? "ppc",
      model: ProjectReport.LARAVEL_TYPE,
      type: "project-report"
    })),

  siteReport: (report?: SiteReport) =>
    FactoryGirl.define(Form, async () => ({
      ...(await defaultAttributesFactory()),
      frameworkKey: report?.frameworkKey ?? "ppc",
      model: SiteReport.LARAVEL_TYPE,
      type: "site-report"
    })),

  nurseryReport: (report?: SiteReport) =>
    FactoryGirl.define(Form, async () => ({
      ...(await defaultAttributesFactory()),
      frameworkKey: report?.frameworkKey ?? "ppc",
      model: NurseryReport.LARAVEL_TYPE,
      type: "nursery-report"
    }))
};
