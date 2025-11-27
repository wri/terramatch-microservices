import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { FormDataService } from "./form-data.service";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { PolicyService } from "@terramatch-microservices/common";
import {
  EntityFormFactory,
  FormQuestionFactory,
  FormSectionFactory,
  SiteFactory,
  SiteReportFactory,
  UpdateRequestFactory
} from "@terramatch-microservices/database/factories";
import { UpdateRequest } from "@terramatch-microservices/database/entities";
import { DRAFT, STARTED } from "@terramatch-microservices/database/constants/status";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import { LinkedAnswerCollector, RelationResourceCollector } from "./linkedAnswerCollector";
import { LinkedFieldResource } from "@terramatch-microservices/database/constants/linked-fields";

jest.mock("./linkedAnswerCollector", () => {
  const { LinkedAnswerCollector } = jest.requireActual("./linkedAnswerCollector");
  class StubbedLinkedAnswerCollector extends LinkedAnswerCollector {
    static singleton: StubbedLinkedAnswerCollector;

    constructor(mediaService: MediaService) {
      super(mediaService);
      return StubbedLinkedAnswerCollector.singleton ?? (StubbedLinkedAnswerCollector.singleton = this);
    }

    collect = jest.fn().mockResolvedValue({});

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
  let collector: LinkedAnswerCollector;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FormDataService,
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        { provide: MediaService, useValue: (mediaService = createMock<MediaService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    service = module.get(FormDataService);
    collector = new LinkedAnswerCollector(mediaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("storeEntityAnswers", () => {
    it("updates the update request if there is one", async () => {
      const site = await SiteFactory.create();
      const updateRequest = await UpdateRequestFactory.forSite(site).create({ content: { color: "blue" } });
      const form = await EntityFormFactory.forSite(site).create();
      await service.storeEntityAnswers(site, form, { color: "red" });
      await updateRequest.reload();
      expect(updateRequest.content).toStrictEqual({ color: "red" });
    });

    it("creates an update request if the user cannot update answers", async () => {
      const site = await SiteFactory.create();
      policyService.hasAccess.mockResolvedValue(false);
      mockUserId(123);
      const form = await EntityFormFactory.forSite(site).create();
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
      const form = await EntityFormFactory.forSite(site).create();
      const section = await FormSectionFactory.forForm(form).create();
      const conditional = await FormQuestionFactory.forSection(section).create({
        inputType: "conditional"
      });
      const name = await FormQuestionFactory.forSection(section).create({
        inputType: "text",
        linkedFieldKey: "site-name"
      });
      const trees = await FormQuestionFactory.forSection(section).create({
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
      const form = await EntityFormFactory.forSiteReport(siteReport).create();
      const section = await FormSectionFactory.forForm(form).create();
      const questions = await FormQuestionFactory.forSection(section).createMany(3, {
        validation: { required: true }
      });
      const nonRequired = await FormQuestionFactory.forSection(section).create();
      const conditional = await FormQuestionFactory.forSection(section).create({ inputType: "conditional" });
      // hidden question that won't count for completion
      await FormQuestionFactory.forSection(section).create({
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
});
