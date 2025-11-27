import { FactoryGirl } from "factory-girl-ts";
import { Form, Project, Site, SiteReport } from "../entities";
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
  forSite: (site?: Site) =>
    FactoryGirl.define(Form, async () => ({
      ...(await defaultAttributesFactory()),
      frameworkKey: site?.frameworkKey ?? "ppc",
      model: Site.LARAVEL_TYPE,
      type: "site"
    })),

  forSiteReport: (siteReport?: SiteReport) =>
    FactoryGirl.define(Form, async () => ({
      ...(await defaultAttributesFactory()),
      frameworkKey: siteReport?.frameworkKey ?? "ppc",
      model: SiteReport.LARAVEL_TYPE,
      type: "site-report"
    }))
};
