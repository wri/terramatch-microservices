import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { FormDataService } from "./form-data.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { PolicyService } from "@terramatch-microservices/common";
import {
  EntityFormFactory,
  FormFactory,
  FormQuestionFactory,
  FormSectionFactory,
  MediaFactory,
  SiteFactory,
  SiteReportFactory,
  UpdateRequestFactory
} from "@terramatch-microservices/database/factories";
import { Form, Organisation, Project, Site, UpdateRequest } from "@terramatch-microservices/database/entities";
import { DRAFT, STARTED } from "@terramatch-microservices/database/constants/status";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import {
  LinkedAnswerCollector,
  RelationResourceCollector
} from "@terramatch-microservices/common/linkedFields/linkedAnswerCollector";
import { LinkedFieldResource } from "@terramatch-microservices/database/constants/linked-fields";
import { faker } from "@faker-js/faker/.";

jest.mock("@terramatch-microservices/common/linkedFields/linkedAnswerCollector", () => {
  const { LinkedAnswerCollector } = jest.requireActual(
    "@terramatch-microservices/common/linkedFields/linkedAnswerCollector"
  );
  class StubbedLinkedAnswerCollector extends LinkedAnswerCollector {
    static singleton?: StubbedLinkedAnswerCollector;

    constructor(mediaService: MediaService, clearSingleton = false) {
      super(mediaService);
      if (clearSingleton) StubbedLinkedAnswerCollector.singleton = undefined;
      return StubbedLinkedAnswerCollector.singleton ?? (StubbedLinkedAnswerCollector.singleton = this);
    }

    protected getCollector(resource: LinkedFieldResource): RelationResourceCollector {
      return super.getCollector(
        resource,
        jest.fn(
          (): RelationResourceCollector => ({
            syncRelation: jest.fn(),
            addField: jest.fn(),
            collect: jest.fn()
          })
        )
      );
    }
  }

  return {
    __esModule: true,
    LinkedAnswerCollector: StubbedLinkedAnswerCollector
  };
});

describe("FormDataService", () => {
  let service: FormDataService;
  let mediaService: DeepMocked<MediaService>;
  let policyService: DeepMocked<PolicyService>;
  let localizationService: DeepMocked<LocalizationService>;
  let collector: LinkedAnswerCollector;

  beforeEach(async () => {
    await Form.truncate();

    const module = await Test.createTestingModule({
      providers: [
        FormDataService,
        { provide: LocalizationService, useValue: (localizationService = createMock<LocalizationService>()) },
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    service = module.get(FormDataService);
    // @ts-expect-error Passing an extra param to the stubbed mock singleton collector
    collector = new LinkedAnswerCollector(mediaService, true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("storeEntityAnswers", () => {
    it("updates the update request if there is one", async () => {
      const site = await SiteFactory.create();
      const updateRequest = await UpdateRequestFactory.forSite(site).create({ content: { color: "blue" } });
      const form = await EntityFormFactory.site(site).create();
      await service.storeEntityAnswers(site, form, { color: "red" });
      await updateRequest.reload();
      expect(updateRequest.content).toStrictEqual({ color: "red" });
    });

    it("creates an update request if the user cannot update answers", async () => {
      const site = await SiteFactory.create();
      policyService.hasAccess.mockResolvedValue(false);
      mockUserId(123);
      const form = await EntityFormFactory.site(site).create();
      await service.storeEntityAnswers(site, form, { color: "red" });

      const updateRequest = await UpdateRequest.for(site).findOne();
      expect(updateRequest).toBeDefined();
      expect(updateRequest?.content).toStrictEqual({ color: "red" });
      expect(updateRequest?.status).toBe(DRAFT);
      expect(updateRequest?.projectId).toBe(site.projectId);
      expect(updateRequest?.frameworkKey).toBe(site.frameworkKey);
      expect(updateRequest?.createdById).toBe(123);

      await site.reload();
      expect(site.updateRequestStatus).toBe(DRAFT);
    });

    it("updates the entity content", async () => {
      const site = await SiteFactory.create();
      const form = await EntityFormFactory.site(site).create();
      const section = await FormSectionFactory.form(form).create();
      const conditional = await FormQuestionFactory.section(section).create({
        inputType: "conditional"
      });
      const name = await FormQuestionFactory.section(section).create({
        inputType: "text",
        linkedFieldKey: "site-name"
      });
      const trees = await FormQuestionFactory.section(section).create({
        inputType: "treeSpecies",
        linkedFieldKey: "site-rel-tree-species",
        collection: "tree-planted"
      });
      policyService.hasAccess.mockResolvedValue(true);
      await service.storeEntityAnswers(site, await form.reload(), {
        [conditional.uuid]: true,
        [name.uuid]: "Site Name",
        [trees.uuid]: [{}]
      });

      expect(site.name).toBe("Site Name");
      expect(site.answers).toStrictEqual({ [conditional.uuid]: true });
      expect(collector.treeSpecies.syncRelation).toHaveBeenCalledTimes(1);
    });

    it("does additional report processing", async () => {
      mockUserId(123);
      policyService.getPermissions.mockResolvedValue(["manage-own"]);
      policyService.hasAccess.mockResolvedValue(true);
      const siteReport = await SiteReportFactory.create({ submittedAt: null, nothingToReport: true });
      const form = await EntityFormFactory.siteReport(siteReport).create();
      const section = await FormSectionFactory.form(form).create();
      const questions = await FormQuestionFactory.section(section).createMany(3, {
        validation: { required: true }
      });
      const nonRequired = await FormQuestionFactory.section(section).create();
      const conditional = await FormQuestionFactory.section(section).create({ inputType: "conditional" });
      // hidden question that won't count for completion
      await FormQuestionFactory.section(section).create({
        parentId: conditional.uuid,
        showOnParentCondition: true,
        validation: { required: true }
      });

      await service.storeEntityAnswers(siteReport, await form.reload(), {
        [questions[0].uuid]: "foo",
        [questions[1].uuid]: "bar",
        [nonRequired.uuid]: "baz",
        [conditional.uuid]: false
      });

      expect(siteReport.completion).toBe(67); // Math.round((2 / 3) * 100)
      expect(siteReport.createdBy).toBe(123);
      expect(siteReport.status).toBe(STARTED);
      expect(siteReport.nothingToReport).toBe(false);
    });
  });

  describe("getDtoForEntity", () => {
    it("translates the form title", async () => {
      let form = await FormFactory.create();
      let dto = await service.getDtoForEntity("projects", new Project(), form, "es-MX");
      expect(dto.formTitle).toBe(form.title);

      form = await FormFactory.create({ titleId: 42 });
      localizationService.translateIds.mockResolvedValue({ 42: "translated title" });
      localizationService.translateFields.mockReturnValue({ title: "translated title" });
      dto = await service.getDtoForEntity("projects", new Project(), form, "es-MX");
      expect(dto.formTitle).toBe("translated title");
    });

    it("uses update request content and feedback when one exists", async () => {
      const site = await SiteFactory.create();
      const updateRequest = await UpdateRequestFactory.forSite(site).create({
        content: { color: "blue" },
        feedback: "please provide new color",
        feedbackFields: ["color"]
      });
      const form = await EntityFormFactory.site(site).create();
      const dto = await service.getDtoForEntity("sites", site, form, "en-US");
      expect(dto.answers).toStrictEqual(updateRequest.content);
      expect(dto.feedback).toBe(updateRequest.feedback);
      expect(dto.feedbackFields).toStrictEqual(updateRequest.feedbackFields);
    });

    it("uses entity content for answers and feedback", async () => {
      const site = await SiteFactory.create({
        name: "Site Name",
        feedback: "New name please!",
        feedbackFields: ["name"]
      });
      const form = await EntityFormFactory.site(site).create();
      const section = await FormSectionFactory.form(form).create();
      const question = await FormQuestionFactory.section(section).create({
        inputType: "text",
        linkedFieldKey: "site-name"
      });
      const dto = await service.getDtoForEntity("sites", site, form, "en-US");
      expect(dto.answers).toStrictEqual({ [question.uuid]: "Site Name" });
      expect(dto.feedback).toBe("New name please!");
      expect(dto.feedbackFields).toStrictEqual(["name"]);
      expect(dto.frameworkKey).toBe(site.frameworkKey);
    });
  });

  describe("getAnswers", () => {
    it("throws when inputs are invalid", async () => {
      await expect(service.getAnswers(new Form(), {})).rejects.toThrow(
        "Expected exactly one model if no answers model is provided"
      );

      await expect(service.getAnswers(new Form(), { projects: new Project(), sites: new Site() })).rejects.toThrow(
        "Expected exactly one model if no answers model is provided"
      );

      await expect(service.getAnswers(new Form(), { organisations: new Organisation() })).rejects.toThrow(
        "Expected entity model if no answers model is provided"
      );
    });

    it("collects answers from the entity model", async () => {
      const site = await SiteFactory.create({ history: faker.lorem.paragraphs(3) });
      const form = await EntityFormFactory.site(site).create();
      const section = await FormSectionFactory.form(form).create();
      const historyQ = await FormQuestionFactory.section(section).create({
        inputType: "text",
        linkedFieldKey: "site-history"
      });
      const conditional = await FormQuestionFactory.section(section).create({ inputType: "conditional" });
      await site.update({ answers: { [conditional.uuid]: true } });
      const fileQ = await FormQuestionFactory.section(section).create({
        inputType: "file",
        linkedFieldKey: "site-col-media"
      });
      const media = await MediaFactory.site(site).create({ collectionName: "media" });
      const treesQ1 = await FormQuestionFactory.section(section).create({
        inputType: "treeSpecies",
        linkedFieldKey: "site-rel-tree-species",
        order: 0
      });
      const treesQ2 = await FormQuestionFactory.section(section).create({
        inputType: "treeSpecies",
        linkedFieldKey: "site-rel-non-tree-species",
        order: 1
      });

      const answers = await service.getAnswers(form, { sites: site });
      expect(answers).toStrictEqual({
        [historyQ.uuid]: site.history,
        [conditional.uuid]: true,
        [fileQ.uuid]: [expect.objectContaining({ uuid: media.uuid, collectionName: "media", fileName: media.fileName })]
      });
      expect(collector.treeSpecies.addField).toHaveBeenCalledTimes(2);
      expect(collector.treeSpecies.addField).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ collection: "tree-planted" }),
        "sites",
        treesQ1.uuid
      );
      expect(collector.treeSpecies.addField).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ collection: "non-tree" }),
        "sites",
        treesQ2.uuid
      );
    });
  });
});
