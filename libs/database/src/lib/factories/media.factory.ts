import { Media, Project, Site, Nursery, ProjectReport, SiteReport, Form, FormQuestionOption } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { ProjectFactory } from "./project.factory";
import { SiteFactory } from "./site.factory";
import { NurseryFactory } from "./nursery.factory";
import { ProjectReportFactory } from "./project-report.factory";
import { SiteReportFactory } from "./site-report.factory";
import { faker } from "@faker-js/faker";
import { UserFactory } from "./user.factory";
import { FormFactory } from "./form.factory";
import { FormQuestionOptionFactory } from "./form-question-option.factory";

const defaultAttributesFactory = async () => ({
  collectionName: faker.lorem.words(1),
  name: faker.lorem.words(2),
  fileName: `${faker.lorem.words(1)}.jpg`,
  size: faker.number.int({ min: 1000, max: 10000 }),
  isPublic: true,
  isCover: false,
  fileType: "media",
  customProperties: {},
  disk: "s3",
  manipulation: [],
  responsiveImages: [],
  createdBy: UserFactory.associate("id")
});

export const MediaFactory = {
  forProject: FactoryGirl.define(Media, async () => ({
    ...(await defaultAttributesFactory()),
    modelType: Project.LARAVEL_TYPE,
    modelId: ProjectFactory.associate("id")
  })),
  forSite: FactoryGirl.define(Media, async () => ({
    ...(await defaultAttributesFactory()),
    modelType: Site.LARAVEL_TYPE,
    modelId: SiteFactory.associate("id")
  })),
  forNursery: FactoryGirl.define(Media, async () => ({
    ...(await defaultAttributesFactory()),
    modelType: Nursery.LARAVEL_TYPE,
    modelId: NurseryFactory.associate("id")
  })),
  forProjectReport: FactoryGirl.define(Media, async () => ({
    ...(await defaultAttributesFactory()),
    modelType: ProjectReport.LARAVEL_TYPE,
    modelId: ProjectReportFactory.associate("id")
  })),
  forSiteReport: FactoryGirl.define(Media, async () => ({
    ...(await defaultAttributesFactory()),
    modelType: SiteReport.LARAVEL_TYPE,
    modelId: SiteReportFactory.associate("id")
  })),
  forForm: FactoryGirl.define(Media, async () => ({
    ...(await defaultAttributesFactory()),
    modelType: Form.LARAVEL_TYPE,
    modelId: FormFactory.associate("id")
  })),
  forFormQuestionOption: FactoryGirl.define(Media, async () => ({
    ...(await defaultAttributesFactory()),
    modelType: FormQuestionOption.LARAVEL_TYPE,
    modelId: FormQuestionOptionFactory.associate("id")
  }))
};
