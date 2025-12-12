import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { FormDataService } from "../entities/form-data.service";
import { PolicyService } from "@terramatch-microservices/common";
import { SubmissionsController } from "./submissions.controller";
import { FormSubmissionFactory } from "@terramatch-microservices/database/factories";

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

  describe("submissionGet", () => {
    it("throws if the submission is not found", async () => {
      formDataService.getFullSubmission.mockResolvedValue(null);
      await expect(controller.submissionGet({ uuid: "fake-uuid" })).rejects.toThrow("Submission not found");
    });

    it("returns the submission DTO", async () => {
      const submission = await FormSubmissionFactory.create();
      formDataService.getFullSubmission.mockResolvedValue(submission);
      await controller.submissionGet({ uuid: submission.uuid });
      expect(policyService.authorize).toHaveBeenCalledWith("read", submission);
      expect(formDataService.getFullSubmission).toHaveBeenCalledWith(submission.uuid);
      expect(formDataService.addSubmissionDto).toHaveBeenCalledWith(expect.anything(), submission);
    });
  });
});
