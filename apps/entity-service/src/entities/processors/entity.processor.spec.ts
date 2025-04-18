import { ProjectProcessor } from "./project.processor";
import { Test } from "@nestjs/testing";
import { MediaService } from "@terramatch-microservices/common/media/media.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { EntitiesService } from "../entities.service";
import { ProjectFactory } from "@terramatch-microservices/database/factories";
import { ActionFactory } from "@terramatch-microservices/database/factories/action.factory";
import { PolicyService } from "@terramatch-microservices/common";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { UnauthorizedException } from "@nestjs/common";

describe("EntityProcessor", () => {
  let processor: ProjectProcessor;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        { provide: MediaService, useValue: createMock<MediaService>() },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: LocalizationService, useValue: createMock<LocalizationService>() },
        EntitiesService
      ]
    }).compile();

    processor = module.get(EntitiesService).createEntityProcessor("projects") as ProjectProcessor;
  });

  afterEach(async () => {
    jest.resetAllMocks();
  });

  describe("delete", () => {
    it("deletes the requested model", async () => {
      const project = await ProjectFactory.create();
      await processor.delete(project);
      await project.reload({ paranoid: false });
      expect(project.deletedAt).not.toBeNull();
    });

    it("deletes associated actions", async () => {
      const project = await ProjectFactory.create();
      const actions = await ActionFactory.forProject.createMany(2, { targetableId: project.id });
      await processor.delete(project);
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
      await processor.update(project, {});
      expect(spy).toHaveBeenCalled();
    });

    it("authorizes for approval when appropriate", async () => {
      const project = await ProjectFactory.create({ status: "started", feedback: null, feedbackFields: null });

      policyService.authorize.mockResolvedValueOnce(undefined);
      await processor.update(project, { status: "awaiting-approval", feedback: "foo", feedbackFields: ["bar"] });
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
  });
});
