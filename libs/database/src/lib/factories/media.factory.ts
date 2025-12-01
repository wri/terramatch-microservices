import { Form, FormQuestionOption, Media, Nursery, Project, ProjectReport, Site, SiteReport } from "../entities";
import { FactoryGirl } from "factory-girl-ts";
import { ProjectFactory } from "./project.factory";
import { SiteFactory } from "./site.factory";
import { NurseryFactory } from "./nursery.factory";
import { ProjectReportFactory } from "./project-report.factory";
import { SiteReportFactory } from "./site-report.factory";
import { faker } from "@faker-js/faker";
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
  responsiveImages: []
});

export const MediaFactory = {
  forProject: (project?: Project) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: Project.LARAVEL_TYPE,
      modelId: (project?.id as number) ?? ProjectFactory.associate("id")
    })),
  forSite: (site?: Site) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: Site.LARAVEL_TYPE,
      modelId: (site?.id as number) ?? SiteFactory.associate("id")
    })),
  forNursery: (nursery?: Nursery) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: Nursery.LARAVEL_TYPE,
      modelId: (nursery?.id as number) ?? NurseryFactory.associate("id")
    })),
  forProjectReport: (report?: ProjectReport) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: ProjectReport.LARAVEL_TYPE,
      modelId: (report?.id as number) ?? ProjectReportFactory.associate("id")
    })),
  forSiteReport: (report?: SiteReport) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: SiteReport.LARAVEL_TYPE,
      modelId: (report?.id as number) ?? SiteReportFactory.associate("id")
    })),
  forForm: (form?: Form) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: Form.LARAVEL_TYPE,
      modelId: (form?.id as number) ?? FormFactory.associate("id")
    })),
  forFormQuestionOption: (question?: FormQuestionOption) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: FormQuestionOption.LARAVEL_TYPE,
      modelId: (question?.id as number) ?? FormQuestionOptionFactory.forQuestion().associate("id")
    }))
};
