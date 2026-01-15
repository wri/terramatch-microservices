import {
  FinancialIndicator,
  Form,
  FormQuestionOption,
  FundingProgramme,
  Media,
  Nursery,
  Organisation,
  Project,
  ProjectPitch,
  ProjectReport,
  Site,
  SiteReport
} from "../entities";
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
import { OrganisationFactory } from "./organisation.factory";
import { FinancialIndicatorFactory } from "./financial-indicator.factory";

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
  project: (project?: Project) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: Project.LARAVEL_TYPE,
      modelId: (project?.id as number) ?? ProjectFactory.associate("id")
    })),
  projectPitch: (pitch?: ProjectPitch) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: ProjectPitch.LARAVEL_TYPE,
      modelId: (pitch?.id as number) ?? ProjectFactory.associate("id")
    })),
  site: (site?: Site) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: Site.LARAVEL_TYPE,
      modelId: (site?.id as number) ?? SiteFactory.associate("id")
    })),
  nursery: (nursery?: Nursery) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: Nursery.LARAVEL_TYPE,
      modelId: (nursery?.id as number) ?? NurseryFactory.associate("id")
    })),
  projectReport: (report?: ProjectReport) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: ProjectReport.LARAVEL_TYPE,
      modelId: (report?.id as number) ?? ProjectReportFactory.associate("id")
    })),
  siteReport: (report?: SiteReport) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: SiteReport.LARAVEL_TYPE,
      modelId: (report?.id as number) ?? SiteReportFactory.associate("id")
    })),
  form: (form?: Form) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: Form.LARAVEL_TYPE,
      modelId: (form?.id as number) ?? FormFactory.associate("id")
    })),
  formQuestionOption: (question?: FormQuestionOption) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: FormQuestionOption.LARAVEL_TYPE,
      modelId: (question?.id as number) ?? FormQuestionOptionFactory.forQuestion().associate("id")
    })),
  org: (org?: Organisation) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: Organisation.LARAVEL_TYPE,
      modelId: (org?.id as number) ?? OrganisationFactory.associate("id")
    })),
  financialIndicator: (indicator?: FinancialIndicator) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: FinancialIndicator.LARAVEL_TYPE,
      modelId: (indicator?.id as number) ?? FinancialIndicatorFactory.report().associate("id")
    })),
  fundingProgrammes: (fp?: FundingProgramme) =>
    FactoryGirl.define(Media, async () => ({
      ...(await defaultAttributesFactory()),
      modelType: FundingProgramme.LARAVEL_TYPE,
      modelId: (fp?.id as number) ?? FinancialIndicatorFactory.report().associate("id")
    }))
};
