import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService, ProcessableEntity } from "../entities.service";
import {
  NurseryReportFactory,
  ProjectFactory,
  ProjectReportFactory,
  SiteReportFactory
} from "@terramatch-microservices/database/factories";
import { ActionFactory } from "@terramatch-microservices/database/factories/action.factory";
import { PolicyService } from "@terramatch-microservices/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

describe("EntityProcessor", () => {
  let service: EntitiesService;
  let policyService: DeepMocked<PolicyService>;

  const createProcessor = (entity: ProcessableEntity = "projects") => service.createEntityProcessor(entity);

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        { provide: ConfigService, useValue: createMock<ConfigService>() },
        EntitiesService
      ]
    }).compile();

    service = module.get(EntitiesService);
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe("delete", () => {
    it("deletes the requested model", async () => {
      const project = await ProjectFactory.create();
      await createProcessor().delete(project);
      await project.reload({ paranoid: false });
      expect(project.deletedAt).not.toBeNull();
    });

    it("deletes associated actions", async () => {
      const project = await ProjectFactory.create();
      const actions = await ActionFactory.forProject.createMany(2, { targetableId: project.id });
      await createProcessor().delete(project);
      for (const action of actions) {
        await action.reload({ paranoid: false });
        expect(action.deletedAt).not.toBeNull();
      }
    });
  });

  describe("update", () => {
    it("calls model.save", async () => {
      const project = await ProjectFactory.create();
      const spy = jest.spyOn(project, "save");
      await createProcessor().update(project, {});
      expect(spy).toHaveBeenCalled();
    });

    it("authorizes for approval when appropriate", async () => {
      const project = await ProjectFactory.create({ status: "started", feedback: null, feedbackFields: null });

      policyService.authorize.mockResolvedValueOnce(undefined);
      const processor = createProcessor();
      await processor.update(project, {
        status: "awaiting-approval",
        feedback: "foo",
        feedbackFields: ["bar"]
      });
      expect(policyService.authorize).not.toHaveBeenCalled();
      // These two should be ignored for non approval statuses
      expect(project.feedback).toBeNull();
      expect(project.feedbackFields).toBeNull();
      policyService.authorize.mockReset();

      policyService.authorize.mockRejectedValueOnce(new UnauthorizedException());
      await expect(processor.update(project, { status: "approved" })).rejects.toThrow(UnauthorizedException);

      policyService.authorize.mockResolvedValueOnce(undefined);
      await processor.update(project, { status: "approved", feedback: "foo", feedbackFields: ["bar"] });
      expect(project.status).toEqual("approved");
      expect(project.feedback).toEqual("foo");
      expect(project.feedbackFields).toEqual(["bar"]);
    });

    describe("nothingToReport", () => {
      it("throws when the property is present on a project report update", async () => {
        const projectReport = await ProjectReportFactory.create();
        const processor = createProcessor("projectReports");
        await expect(processor.update(projectReport, { nothingToReport: true })).rejects.toThrow(BadRequestException);
        await expect(processor.update(projectReport, { nothingToReport: false })).rejects.toThrow(BadRequestException);
      });

      it("throws if the request attempts to set status", async () => {
        let siteReport = await SiteReportFactory.create({ submittedAt: null });
        const processor = createProcessor("siteReports");
        await expect(processor.update(siteReport, { nothingToReport: true, status: "started" })).rejects.toThrow(
          BadRequestException
        );
        siteReport = await SiteReportFactory.create({ submittedAt: null });
        await expect(
          processor.update(siteReport, { nothingToReport: false, status: "started" })
        ).resolves.not.toThrow();
        siteReport = await SiteReportFactory.create({ submittedAt: null });
        await expect(
          processor.update(siteReport, { nothingToReport: true, status: "awaiting-approval" })
        ).resolves.not.toThrow();
      });

      it("Sets completion and submission date", async () => {
        const report = await NurseryReportFactory.create({
          completion: undefined,
          submittedAt: undefined,
          nothingToReport: undefined
        });
        const processor = createProcessor("nurseryReports");
        await processor.update(report, { nothingToReport: true });
        expect(report.nothingToReport).toBe(true);
        expect(report.status).toBe("awaiting-approval");
        expect(report.completion).toBe(100);
        expect(report.submittedAt).not.toBeNull();
      });
    });
  });
});
