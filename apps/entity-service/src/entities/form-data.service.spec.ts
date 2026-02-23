import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { FormDataService } from "./form-data.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { PolicyService } from "@terramatch-microservices/common";
import {
  ApplicationFactory,
  EntityFormFactory,
  FormFactory,
  FormQuestionFactory,
  FormSectionFactory,
  FormSubmissionFactory,
  FundingProgrammeFactory,
  I18nItemFactory,
  MediaFactory,
  OrganisationFactory,
  ProjectPitchFactory,
  SiteFactory,
  SiteReportFactory,
  StageFactory,
  UpdateRequestFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import {
  Form,
  I18nTranslation,
  Organisation,
  Project,
  Site,
  UpdateRequest
} from "@terramatch-microservices/database/entities";
import { DRAFT, STARTED } from "@terramatch-microservices/database/constants/status";
import { mockTranslateFieldsWithOriginal, mockUserId, serialize } from "@terramatch-microservices/common/util/testing";
import {
  LinkedAnswerCollector,
  RelationResourceCollector
} from "@terramatch-microservices/common/linkedFields/linkedAnswerCollector";
import { LinkedFieldResource } from "@terramatch-microservices/database/constants/linked-fields";
import { faker } from "@faker-js/faker/.";
import { buildJsonApi, Resource } from "@terramatch-microservices/common/util";
import { SubmissionDto } from "./dto/submission.dto";
import { I18nTranslationFactory } from "@terramatch-microservices/database/factories/i18n-translation.factory";
import { FundingProgrammeDto } from "../fundingProgrammes/dto/funding-programme.dto";

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
            collect: jest.fn(),
            clearRelations: jest.fn()
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
      const updateRequest = await UpdateRequestFactory.site(site).create({ content: { color: "blue" } });
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

  describe("storeSubmissionAnswers", () => {
    it("throws if the org or project pitch is missing", async () => {
      const form = await FormFactory.create();
      const pitch = await ProjectPitchFactory.create();
      let submission = await FormSubmissionFactory.create({ projectPitchUuid: pitch.uuid });
      await expect(service.storeSubmissionAnswers(submission, form, {})).rejects.toThrow(
        "Submission must have an organisation and project pitch"
      );

      const organisation = await OrganisationFactory.create();
      submission = await FormSubmissionFactory.create({ organisationUuid: organisation.uuid });
      await expect(service.storeSubmissionAnswers(submission, form, {})).rejects.toThrow(
        "Submission must have an organisation and project pitch"
      );
    });

    it("updates content in the org and pitch", async () => {
      const pitch = await ProjectPitchFactory.create();
      const org = await OrganisationFactory.create();
      const submission = await FormSubmissionFactory.create({
        organisationUuid: org.uuid,
        projectPitchUuid: pitch.uuid
      });
      const form = await FormFactory.create();
      const section = await FormSectionFactory.form(form).create();
      const conditional = await FormQuestionFactory.section(section).create({ inputType: "conditional" });
      const orgQuestion = await FormQuestionFactory.section(section).create({
        inputType: "text",
        linkedFieldKey: "org-name"
      });
      const pitchQuestion = await FormQuestionFactory.section(section).create({
        inputType: "text",
        linkedFieldKey: "pro-pit-name"
      });
      await service.storeSubmissionAnswers(submission, form, {
        [conditional.uuid]: true,
        [orgQuestion.uuid]: "Org Name",
        [pitchQuestion.uuid]: "Pitch Name"
      });

      await org.reload();
      await pitch.reload();
      expect(submission.answers).toMatchObject({ [conditional.uuid]: true });
      expect(org.name).toEqual("Org Name");
      expect(pitch.projectName).toEqual("Pitch Name");
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
      const updateRequest = await UpdateRequestFactory.site(site).create({
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

  describe("getFullSubmission", () => {
    it("returns a submission with all necessary associations", async () => {
      const org = await OrganisationFactory.create();
      const pitch = await ProjectPitchFactory.create();
      const application = await ApplicationFactory.create({ organisationUuid: org.uuid });
      const form = await FormFactory.create();
      const stage = await StageFactory.create({});
      const user = await UserFactory.create();
      const submission = await FormSubmissionFactory.create({
        organisationUuid: org.uuid,
        applicationId: application.id,
        projectPitchUuid: pitch.uuid,
        formId: form.uuid,
        stageUuid: stage.uuid,
        userId: user.uuid
      });

      const result = await service.getFullSubmission(submission.uuid);
      expect(result?.form?.title).toBe(form.title);
      expect(result?.application?.uuid).toBe(application.uuid);
      expect(result?.organisation?.name).toBe(org.name);
      expect(result?.projectPitch?.projectCountry).toBe(pitch.projectCountry);
      expect(result?.stage?.name).toBe(stage.name);
      expect(result?.user?.firstName).toBe(user.firstName);
    });
  });

  describe("addSubmissionDto", () => {
    it("throws if the submission does not have a form", async () => {
      const submission = await FormSubmissionFactory.create({ formId: "fake-uuid" });
      await expect(service.addSubmissionDto(buildJsonApi(SubmissionDto), submission)).rejects.toThrow(
        "Form not found for submission"
      );
    });

    it("fills out the full submission dto", async () => {
      const org = await OrganisationFactory.create({ phone: faker.phone.number() });
      const pitch = await ProjectPitchFactory.create({ totalHectares: faker.number.int({ min: 10, max: 100 }) });
      const application = await ApplicationFactory.create({ organisationUuid: org.uuid });
      const form = await FormFactory.create();
      const section = await FormSectionFactory.form(form).create();
      const orgQuestion = await FormQuestionFactory.section(section).create({
        inputType: "text",
        linkedFieldKey: "org-phone"
      });
      const pitchQuestion = await FormQuestionFactory.section(section).create({
        inputType: "number",
        linkedFieldKey: "pro-pit-tot-ha"
      });
      const conditional = await FormQuestionFactory.section(section).create({ inputType: "conditional" });
      const stage = await StageFactory.create({});
      const user = await UserFactory.create({ locale: "es-MX" });
      mockUserId(user.id);
      const submission = await FormSubmissionFactory.create({
        answers: { [conditional.uuid]: true },
        organisationUuid: org.uuid,
        applicationId: application.id,
        projectPitchUuid: pitch.uuid,
        formId: form.uuid,
        stageUuid: stage.uuid,
        userId: user.uuid,
        feedbackFields: ["Organisation Phone Number"]
      });

      const i18nItem = await I18nItemFactory.create({ shortValue: "Organisation Phone Number" });
      await I18nTranslation.truncate();
      await I18nTranslationFactory.create({ shortValue: "Organisation Phone Number", i18nItemId: i18nItem.id });
      localizationService.translateIds.mockResolvedValue({ [i18nItem.id]: "Número de teléfono de la organización" });

      const document = buildJsonApi(SubmissionDto);
      // Setting up this test is easier if the appropriate associations are loaded by the service.
      const forService = await service.getFullSubmission(submission.uuid);
      if (forService == null) throw new Error("Expected submission to exist");
      // test the service call fetching these when needed
      forService.organisation = null;
      forService.projectPitch = null;
      await service.addSubmissionDto(document, forService);

      expect(localizationService.translateIds).toHaveBeenCalledWith([i18nItem.id], "es-MX");
      const dto = (serialize(document).data as Resource).attributes;
      expect(dto.uuid).toBe(submission.uuid);
      expect(dto.updatedByName).toBe(user.fullName);
      expect(dto.applicationUuid).toBe(application.uuid);
      expect(dto.projectPitchUuid).toBe(pitch.uuid);
      expect(dto.formUuid).toBe(form.uuid);
      expect(dto.frameworkKey).toBe(form.frameworkKey);
      expect(dto.status).toBe(submission.status);
      expect(dto.organisationName).toBe(org.name);
      expect(dto.translatedFeedbackFields).toEqual(["Número de teléfono de la organización"]);
      expect(dto.answers).toMatchObject({
        [conditional.uuid]: true,
        [orgQuestion.uuid]: org.phone,
        [pitchQuestion.uuid]: pitch.totalHectares
      });
    });
  });

  describe("addFundingProgrammeDto", () => {
    it("fills out the funding programme dto", async () => {
      const programme = await FundingProgrammeFactory.create();
      const cover = await MediaFactory.fundingProgrammes(programme).create({ collectionName: "cover" });
      const stages = [
        await StageFactory.create({ fundingProgrammeId: programme.uuid, order: 2 }),
        await StageFactory.create({ fundingProgrammeId: programme.uuid, order: 1 })
      ];
      await Promise.all(stages.map(stage => stage.reload()));
      stages.reverse(); // the orders are swapped in the creation order to test the order sort in the service.
      const forms = await Promise.all(stages.map(stage => FormFactory.create({ stageId: stage.uuid })));

      const result = serialize(await service.addFundingProgrammeDtos(buildJsonApi(FundingProgrammeDto), [programme]));
      const dto = (result.data as Resource).attributes;
      expect(localizationService.translateIds).not.toHaveBeenCalled();
      expect(dto).toMatchObject({
        uuid: programme.uuid,
        name: programme.name,
        description: programme.description,
        location: programme.location,
        cover: expect.objectContaining({ uuid: cover.uuid, collectionName: "cover" }),
        stages: stages.map((stage, index) =>
          expect.objectContaining({ uuid: stage.uuid, formUuid: forms[index].uuid, deadlineAt: stage.deadlineAt })
        )
      });
    });

    it("translates if a locale is provided", async () => {
      const programmes = [
        await FundingProgrammeFactory.create({ nameId: 1, descriptionId: 2, locationId: 3 }),
        await FundingProgrammeFactory.create({ nameId: 4 })
      ];
      mockTranslateFieldsWithOriginal(localizationService);
      localizationService.translateIds.mockResolvedValue({
        1: "translated name",
        2: "translated description",
        3: "translated location",
        4: "other translated named"
      });
      const result = serialize(
        await service.addFundingProgrammeDtos(buildJsonApi(FundingProgrammeDto), programmes, "es-MX")
      );
      const dtos = (result.data as Resource[]).map(({ attributes }) => attributes);
      expect(dtos[0]).toMatchObject({
        name: "translated name",
        description: "translated description",
        location: "translated location"
      });
      expect(dtos[1]).toMatchObject({
        name: "other translated named",
        description: programmes[1].description,
        location: programmes[1].location
      });
    });
  });
});
