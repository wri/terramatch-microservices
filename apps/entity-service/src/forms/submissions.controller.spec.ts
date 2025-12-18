import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { FormDataService } from "../entities/form-data.service";
import { PolicyService } from "@terramatch-microservices/common";
import { SubmissionsController } from "./submissions.controller";
import {
  FormFactory,
  FormSubmissionFactory,
  OrganisationFactory,
  StageFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import { FormSubmission } from "@terramatch-microservices/database/entities";

describe("SubmissionsController", () => {
  let controller: SubmissionsController;
  let formDataService: DeepMocked<FormDataService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubmissionsController],
      providers: [
        { provide: FormDataService, useValue: (formDataService = createMock<FormDataService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(SubmissionsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("get", () => {
    it("throws if the submission is not found", async () => {
      formDataService.getFullSubmission.mockResolvedValue(null);
      await expect(controller.get({ uuid: "fake-uuid" })).rejects.toThrow("Submission not found");
    });

    it("returns the submission DTO", async () => {
      const submission = await FormSubmissionFactory.create();
      formDataService.getFullSubmission.mockResolvedValue(submission);
      await controller.get({ uuid: submission.uuid });
      expect(policyService.authorize).toHaveBeenCalledWith("read", submission);
      expect(formDataService.getFullSubmission).toHaveBeenCalledWith(submission.uuid);
      expect(formDataService.addSubmissionDto).toHaveBeenCalledWith(expect.anything(), submission);
    });
  });

  describe("create", () => {
    it("throws if the form doesn't have a stage", async () => {
      await expect(
        controller.create({ data: { type: "submissions", attributes: { formUuid: "fake-uuid" } } })
      ).rejects.toThrow("Form is not assigned to a stage");

      const form = await FormFactory.create();
      await expect(
        controller.create({ data: { type: "submissions", attributes: { formUuid: form.uuid } } })
      ).rejects.toThrow("Form is not assigned to a stage");
    });

    it("throws if the user doesn't have an org", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      const form = await FormFactory.create({ stageId: (await StageFactory.create()).uuid });
      await expect(
        controller.create({ data: { type: "submissions", attributes: { formUuid: form.uuid } } })
      ).rejects.toThrow("Authenticated user is not assigned to an organisation");
    });

    it("creates the submission, application and project pitch", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      mockUserId(user.id);
      const stage = await StageFactory.create();
      const form = await FormFactory.create({ stageId: stage.uuid });

      await controller.create({ data: { type: "submissions", attributes: { formUuid: form.uuid } } });

      // The service that generates the DTO is mocked in this spec, so we pull the most recently created
      // submission
      const submission = (await FormSubmission.findOne({
        order: [["id", "DESC"]],
        include: [
          { association: "projectPitch", attributes: ["organisationId", "fundingProgrammeId"] },
          { association: "application", attributes: ["organisationUuid", "fundingProgrammeUuid", "updatedBy"] }
        ]
      })) as FormSubmission;
      expect(submission).toBeDefined();
      expect(submission.formId).toBe(form.uuid);
      expect(submission.stageUuid).toBe(stage.uuid);
      expect(submission.userId).toBe(user.uuid);
      expect(submission.organisationUuid).toBe(org.uuid);
      expect(submission.projectPitch?.organisationId).toBe(org.uuid);
      expect(submission.projectPitch?.fundingProgrammeId).toBe(stage.fundingProgrammeId);
      expect(submission.application?.organisationUuid).toBe(org.uuid);
      expect(submission.application?.fundingProgrammeUuid).toBe(stage.fundingProgrammeId);
      expect(submission.application?.updatedBy).toBe(user.id);
      expect(policyService.authorize).toHaveBeenCalledWith("create", expect.objectContaining({ formId: form.uuid }));
      expect(formDataService.addSubmissionDto).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ uuid: submission.uuid }),
        expect.objectContaining({ uuid: form.uuid }),
        user.locale
      );
    });
  });
});
