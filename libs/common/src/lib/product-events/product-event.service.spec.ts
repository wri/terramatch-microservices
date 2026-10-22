import {
  FormFactory,
  FormSubmissionFactory,
  OrganisationFactory,
  OrganisationUserFactory,
  ProjectFactory,
  TaskFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";
import { APPLICATION_SUBMITTED, ProductEventService } from "./product-event.service";
import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { DateTime } from "luxon";
import { faker } from "@faker-js/faker";
import { mockUserContext } from "../util/testing";
import { ApplicationSubmittedEmail } from "../email/application-submitted.email";
import { ConfigService } from "@nestjs/config";
import { FormSubmission, Notification } from "@terramatch-microservices/database/entities";
import { DatabaseModule } from "@terramatch-microservices/database";

describe("ProductEventService", () => {
  let module: TestingModule;
  let service: ProductEventService;
  let emailQueue: DeepMocked<Queue>;
  let configService: DeepMocked<ConfigService>;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        ProductEventService,
        { provide: getQueueToken("email"), useValue: (emailQueue = createMock<Queue>()) },
        { provide: ConfigService, useValue: (configService = createMock<ConfigService>()) }
      ]
    }).compile();

    service = module.get(ProductEventService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("taskCreated", () => {
    it("should queue report reminder emails when a TF report-reminder framework task is created", async () => {
      const project = await ProjectFactory.create({ frameworkKey: "terrafund-landscapes" });
      const dueAt = DateTime.utc(2027, 1, 31).toJSDate();
      const task = await TaskFactory.create({ projectId: project.id, dueAt });

      await service.taskCreated(task);

      expect(emailQueue.add).toHaveBeenCalledWith(
        "terrafundReportReminder",
        expect.objectContaining({ projectIds: [project.id], dueAt: dueAt.toISOString() })
      );
    });
  });

  describe("notify", () => {
    describe(APPLICATION_SUBMITTED, () => {
      it("queues the application submitted email with the form's submission message", async () => {
        const user = await UserFactory.create();
        mockUserContext({ userId: user.id });
        const form = await FormFactory.create({ submissionMessage: faker.lorem.sentence() });
        const submission = await FormSubmissionFactory.create({ formId: form.uuid });

        await service.notify(APPLICATION_SUBMITTED, submission);

        expect(emailQueue.add).toHaveBeenCalledWith(
          ApplicationSubmittedEmail.NAME,
          expect.objectContaining({ message: form.submissionMessage, userId: user.id })
        );
      });

      it("falls back to a default message when the form has none", async () => {
        const user = await UserFactory.create();
        mockUserContext({ userId: user.id });
        const form = await FormFactory.create({ submissionMessage: null });
        const submission = await FormSubmissionFactory.create({ formId: form.uuid });

        await service.notify(APPLICATION_SUBMITTED, submission);

        expect(emailQueue.add).toHaveBeenCalledWith(
          ApplicationSubmittedEmail.NAME,
          expect.objectContaining({ message: "Thank you for sending your application.", userId: user.id })
        );
      });

      it("creates a notification for each owner and approved partner of the organisation", async () => {
        const user = await UserFactory.create();
        mockUserContext({ userId: user.id });
        configService.get.mockReturnValue("staging");
        const organisation = await OrganisationFactory.create();
        const owners = await UserFactory.createMany(2, { organisationId: organisation.id });
        const partner = await UserFactory.create();
        await OrganisationUserFactory.create({
          organisationId: organisation.id,
          userId: partner.id,
          status: "approved"
        });
        const pending = await UserFactory.create();
        await OrganisationUserFactory.create({
          organisationId: organisation.id,
          userId: pending.id,
          status: "pending"
        });
        await UserFactory.create({ organisationId: (await OrganisationFactory.create()).id });
        const submission = await FormSubmissionFactory.create({ organisationUuid: organisation.uuid });
        const emitSpy = jest.spyOn(DatabaseModule, "emitUserDataModelUpdated").mockResolvedValue();

        await service.notify(APPLICATION_SUBMITTED, submission);

        const notifications = await Notification.findAll({
          where: { referencedModel: FormSubmission.LARAVEL_TYPE, referencedModelId: submission.id }
        });
        expect(notifications.map(({ userId }) => userId).sort()).toEqual(
          [...owners.map(({ id }) => id), partner.id].sort()
        );
        for (const notification of notifications) {
          expect(notification).toMatchObject({ category: "applications", createdBy: user.id, projectId: null });
          expect(emitSpy).toHaveBeenCalledWith({
            userIds: [notification.userId],
            model: "notifications",
            modelId: notification.id
          });
        }
      });

      it("does not create notifications in production", async () => {
        mockUserContext({ userId: (await UserFactory.create()).id });
        configService.get.mockReturnValue("prod");
        const organisation = await OrganisationFactory.create();
        await UserFactory.create({ organisationId: organisation.id });
        const submission = await FormSubmissionFactory.create({ organisationUuid: organisation.uuid });

        await service.notify(APPLICATION_SUBMITTED, submission);

        expect(
          await Notification.count({
            where: { referencedModel: FormSubmission.LARAVEL_TYPE, referencedModelId: submission.id }
          })
        ).toBe(0);
        expect(emailQueue.add).toHaveBeenCalledWith(ApplicationSubmittedEmail.NAME, expect.anything());
      });

      it("does not queue an email without an authenticated user", async () => {
        mockUserContext();
        const submission = await FormSubmissionFactory.create();

        await service.notify(APPLICATION_SUBMITTED, submission);

        expect(emailQueue.add).not.toHaveBeenCalled();
      });
    });
  });
});
