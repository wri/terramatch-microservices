import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { FormDataService } from "../entities/form-data.service";
import { PolicyService } from "@terramatch-microservices/common";
import { SubmissionsController } from "./submissions.controller";
import {
  ApplicationFactory,
  FormFactory,
  FormSubmissionFactory,
  FundingProgrammeFactory,
  OrganisationFactory,
  ProjectPitchFactory,
  StageFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import { FormSubmission } from "@terramatch-microservices/database/entities";
import { UpdateSubmissionAttributes } from "../entities/dto/submission.dto";

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
    it("throws if the funding programme UUID is invalid", async () => {
      await expect(
        controller.create({ data: { type: "submissions", attributes: { fundingProgrammeUuid: "fake-uuid" } } })
      ).rejects.toThrow("Funding programme not found");

      const programme = await FundingProgrammeFactory.create();
      await expect(
        controller.create({ data: { type: "submissions", attributes: { fundingProgrammeUuid: programme.uuid } } })
      ).rejects.toThrow("Funding programme has no stages");
    });

    it("throws if the first stage doesn't have a form", async () => {
      const programme = await FundingProgrammeFactory.create();
      await StageFactory.create({ fundingProgrammeId: programme.uuid });
      await expect(
        controller.create({ data: { type: "submissions", attributes: { fundingProgrammeUuid: programme.uuid } } })
      ).rejects.toThrow("Form for stage not found");
    });

    it("throws if the user doesn't have an org", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);
      const programme = await FundingProgrammeFactory.create();
      const stage = await StageFactory.create({ fundingProgrammeId: programme.uuid });
      await FormFactory.create({ stageId: stage.uuid });
      await expect(
        controller.create({ data: { type: "submissions", attributes: { fundingProgrammeUuid: programme.uuid } } })
      ).rejects.toThrow("Authenticated user is not assigned to an organisation");
    });

    it("throws if the previous submission is not approved", async () => {
      const programme = await FundingProgrammeFactory.create();
      const stage = await StageFactory.create({ fundingProgrammeId: programme.uuid });
      const form = await FormFactory.create({ stageId: stage.uuid });
      const submission = await FormSubmissionFactory.create({ formId: form.uuid, status: "awaiting-approval" });
      await expect(
        controller.create({
          data: {
            type: "submissions",
            attributes: { fundingProgrammeUuid: programme.uuid, nextStageFromSubmissionUuid: submission.uuid }
          }
        })
      ).rejects.toThrow("Previous submission is not approved");
    });

    it("throws if the previous submission is missing an application or pitch", async () => {
      const programme = await FundingProgrammeFactory.create();
      const stage = await StageFactory.create({ fundingProgrammeId: programme.uuid });
      const form = await FormFactory.create({ stageId: stage.uuid });
      let submission = await FormSubmissionFactory.create({ formId: form.uuid, status: "approved" });

      const test = async () =>
        await expect(
          controller.create({
            data: {
              type: "submissions",
              attributes: { fundingProgrammeUuid: programme.uuid, nextStageFromSubmissionUuid: submission.uuid }
            }
          })
        ).rejects.toThrow("Previous submission is missing an application or project pitch");
      await test();

      submission = await FormSubmissionFactory.create({
        formId: form.uuid,
        status: "approved",
        applicationId: null,
        projectPitchUuid: (await ProjectPitchFactory.create()).uuid
      });
      await test();
    });

    it("throws if the previous submission stage is not part of this programme", async () => {
      const programme = await FundingProgrammeFactory.create();
      await StageFactory.create({ fundingProgrammeId: programme.uuid });
      const submission = await FormSubmissionFactory.create({
        stageUuid: (await StageFactory.create()).uuid,
        projectPitchUuid: (await ProjectPitchFactory.create()).uuid,
        status: "approved"
      });
      await expect(
        controller.create({
          data: {
            type: "submissions",
            attributes: { fundingProgrammeUuid: programme.uuid, nextStageFromSubmissionUuid: submission.uuid }
          }
        })
      ).rejects.toThrow("Previous submission stage not found in funding programme");
    });

    it("throws if the next stage cannot be found", async () => {
      const programme = await FundingProgrammeFactory.create();
      const stage = await StageFactory.create({ fundingProgrammeId: programme.uuid, order: 1 });
      const form = await FormFactory.create({ stageId: stage.uuid });
      const submission = await FormSubmissionFactory.create({
        formId: form.uuid,
        stageUuid: stage.uuid,
        status: "approved",
        projectPitchUuid: (await ProjectPitchFactory.create()).uuid
      });

      await expect(
        controller.create({
          data: {
            type: "submissions",
            attributes: {
              fundingProgrammeUuid: programme.uuid,
              nextStageFromSubmissionUuid: submission.uuid
            }
          }
        })
      ).rejects.toThrow("There is no next stage in the funding programme");
    });

    it("creates the submission, application and project pitch for the first stage", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      mockUserId(user.id);

      const programme = await FundingProgrammeFactory.create();
      const stage = await StageFactory.create({ fundingProgrammeId: programme.uuid });
      const form = await FormFactory.create({ stageId: stage.uuid });

      await controller.create({ data: { type: "submissions", attributes: { fundingProgrammeUuid: programme.uuid } } });

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

    it("creates the submission, application and project pitch for the next stage", async () => {
      const org = await OrganisationFactory.create();
      const user = await UserFactory.create({ organisationId: org.id });
      mockUserId(user.id);

      const programme = await FundingProgrammeFactory.create();
      const stages = [
        await StageFactory.create({ fundingProgrammeId: programme.uuid, order: 1 }),
        await StageFactory.create({ fundingProgrammeId: programme.uuid, order: 2 }),
        await StageFactory.create({ fundingProgrammeId: programme.uuid, order: 3 })
      ];
      const forms = await Promise.all(stages.map(({ uuid }) => FormFactory.create({ stageId: uuid })));

      const application = await ApplicationFactory.create({ organisationUuid: org.uuid, updatedBy: user.id - 1 });
      const pitch = await ProjectPitchFactory.create({ organisationId: org.uuid });
      const previousSubmission = await FormSubmissionFactory.create({
        stageUuid: stages[1].uuid,
        formId: forms[1].uuid,
        status: "approved",
        applicationId: application.id,
        projectPitchUuid: pitch.uuid
      });

      await controller.create({
        data: {
          type: "submissions",
          attributes: { fundingProgrammeUuid: programme.uuid, nextStageFromSubmissionUuid: previousSubmission.uuid }
        }
      });

      // The service that generates the DTO is mocked in this spec, so we pull the most recently created
      // submission
      const submission = (await FormSubmission.findOne({
        order: [["id", "DESC"]],
        include: [{ association: "application", attributes: ["updatedBy"] }]
      })) as FormSubmission;
      expect(submission).toBeDefined();
      expect(submission.formId).toBe(forms[2].uuid);
      expect(submission.stageUuid).toBe(stages[2].uuid);
      expect(submission.userId).toBe(user.uuid);
      expect(submission.organisationUuid).toBe(org.uuid);
      expect(submission.application?.updatedBy).toBe(user.id);
      expect(policyService.authorize).toHaveBeenCalledWith(
        "create",
        expect.objectContaining({ formId: forms[2].uuid })
      );
      expect(formDataService.addSubmissionDto).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ uuid: submission.uuid }),
        expect.objectContaining({ uuid: forms[2].uuid }),
        user.locale
      );
    });
  });

  describe("update", () => {
    it("throws if the path and payload don't match", async () => {
      await expect(
        controller.update({ uuid: "fake-uuid" }, { data: { id: "fake-uuid-2", type: "submissions", attributes: {} } })
      ).rejects.toThrow("Submission id in path and payload do not match");
    });

    it("throws if the submission is not found", async () => {
      formDataService.getFullSubmission.mockResolvedValue(null);
      await expect(
        controller.update({ uuid: "fake-uuid" }, { data: { id: "fake-uuid", type: "submissions", attributes: {} } })
      ).rejects.toThrow("Submission not found");
    });

    it("throws if the submission doesn't have a form", async () => {
      const submission = await FormSubmissionFactory.create();
      formDataService.getFullSubmission.mockResolvedValue(submission);
      await expect(
        controller.update(
          { uuid: submission.uuid },
          { data: { id: submission.uuid, type: "submissions", attributes: {} } }
        )
      ).rejects.toThrow("Form for submission not found");
    });

    it("calls the service to update the answers", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);

      const form = await FormFactory.create();
      const submission = await FormSubmissionFactory.create({ formId: form.uuid });
      const attributes = { answers: {} };

      formDataService.getFullSubmission.mockResolvedValue(submission);
      await controller.update(
        { uuid: submission.uuid },
        { data: { id: submission.uuid, type: "submissions", attributes } }
      );

      expect(policyService.authorize).toHaveBeenCalledWith("updateAnswers", submission);
      expect(formDataService.storeSubmissionAnswers).toHaveBeenCalledWith(
        submission,
        expect.objectContaining({ uuid: form.uuid }),
        attributes.answers
      );
    });

    it("updates the submissions status and feedback", async () => {
      const user = await UserFactory.create();
      mockUserId(user.id);

      const form = await FormFactory.create();
      const submission = await FormSubmissionFactory.create({ formId: form.uuid, status: "awaiting-approval" });
      const attributes: UpdateSubmissionAttributes = {
        status: "rejected",
        feedback: "Some feedback",
        feedbackFields: ["one", "two"]
      };

      formDataService.getFullSubmission.mockResolvedValue(submission);

      await controller.update(
        { uuid: submission.uuid },
        { data: { id: submission.uuid, type: "submissions", attributes } }
      );

      await submission.reload();
      expect(policyService.authorize).toHaveBeenCalledWith("update", submission);
      expect(submission.status).toBe("rejected");
      expect(submission.feedback).toBe("Some feedback");
      expect(submission.feedbackFields).toEqual(["one", "two"]);
    });
  });
});
