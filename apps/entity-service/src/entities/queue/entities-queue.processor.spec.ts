import {
  CREATE_PROJECT_FOR_APPLICATION,
  EntitiesQueueProcessor,
  GENERATE_APPLICATION_EXPORT,
  GENERATE_FRAMEWORK_ENTITY_EXPORT
} from "./entities-queue.processor";
import { Test } from "@nestjs/testing";
import { EntitiesService } from "../entities.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Job, Queue } from "bullmq";
import { v4 as uuidv4 } from "uuid";
import { getQueueToken } from "@nestjs/bullmq";
import {
  ApplicationFactory,
  EntityFormFactory,
  FormSubmissionFactory,
  FrameworkFactory,
  FundingProgrammeFactory
} from "@terramatch-microservices/database/factories";
import { faker } from "@faker-js/faker";
import { FrameworkKey } from "@terramatch-microservices/database/constants";
import { Project, SavedExport } from "@terramatch-microservices/database/entities";
import { ProjectProcessor } from "../processors";
import { FormsService } from "../../forms/forms.service";

describe("EntitiesQueueProcessor", () => {
  let processor: EntitiesQueueProcessor;
  let entitiesService: DeepMocked<EntitiesService>;
  let formsService: DeepMocked<FormsService>;
  let emailQueue: DeepMocked<Queue>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EntitiesQueueProcessor,
        { provide: EntitiesService, useValue: (entitiesService = createMock<EntitiesService>()) },
        { provide: FormsService, useValue: (formsService = createMock<FormsService>()) },
        { provide: getQueueToken("email"), useValue: (emailQueue = createMock<Queue>()) }
      ]
    }).compile();

    processor = await module.resolve(EntitiesQueueProcessor);
  });

  describe("process", () => {
    it("throws if the event is unrecognized", async () => {
      await expect(processor.process({ name: "unrecognized", data: { foo: "bar" } } as Job)).rejects.toThrow(
        'Received unknown job unrecognized with data {"foo":"bar"} in entities queue'
      );
    });
  });

  describe("createProjectForApplication", () => {
    it("throws if the application id not a number", async () => {
      await expect(processor.process({ name: CREATE_PROJECT_FOR_APPLICATION, data: {} } as Job)).rejects.toThrow(
        "Invalid applicationId: {}"
      );
      await expect(
        processor.process({ name: CREATE_PROJECT_FOR_APPLICATION, data: { applicationId: "3" } } as Job)
      ).rejects.toThrow('Invalid applicationId: {"applicationId":"3"}');
    });

    it("throws if the application is not found", async () => {
      await expect(
        processor.process({ name: CREATE_PROJECT_FOR_APPLICATION, data: { applicationId: -1 } } as Job)
      ).rejects.toThrow("Application not found for ID: -1");
    });

    it("throws if the framework is missing", async () => {
      const application = await ApplicationFactory.create();
      await expect(
        processor.process({ name: CREATE_PROJECT_FOR_APPLICATION, data: { applicationId: application.id } } as Job)
      ).rejects.toThrow(`Application funding programme or framework not found for ID: ${application.id}`);
    });

    it("throws if the framework is missing a project form", async () => {
      const framework = await FrameworkFactory.create();
      const fp = await FundingProgrammeFactory.create({ frameworkKey: framework.slug });
      const application = await ApplicationFactory.create({ fundingProgrammeUuid: fp.uuid });
      await expect(
        processor.process({ name: CREATE_PROJECT_FOR_APPLICATION, data: { applicationId: application.id } } as Job)
      ).rejects.toThrow(`Framework does not have a project form assigned: ${framework.slug}`);
    });

    it("throws if the submission is missing", async () => {
      const frameworkKey = faker.lorem.slug() as FrameworkKey;
      const form = await EntityFormFactory.project().create({ frameworkKey });
      const framework = await FrameworkFactory.create({ slug: frameworkKey, projectFormUuid: form.uuid });
      const fp = await FundingProgrammeFactory.create({ frameworkKey: framework.slug });
      const application = await ApplicationFactory.create({ fundingProgrammeUuid: fp.uuid });
      await expect(
        processor.process({ name: CREATE_PROJECT_FOR_APPLICATION, data: { applicationId: application.id } } as Job)
      ).rejects.toThrow(`Application does not have a form submission: ${application.id}`);
    });

    it("creates a project and sends an email", async () => {
      const frameworkKey = faker.lorem.slug() as FrameworkKey;
      const form = await EntityFormFactory.project().create({ frameworkKey });
      const framework = await FrameworkFactory.create({ projectFormUuid: form.uuid });
      const fp = await FundingProgrammeFactory.create({ frameworkKey: framework.slug });
      const application = await ApplicationFactory.create({ fundingProgrammeUuid: fp.uuid });
      await expect(
        processor.process({ name: CREATE_PROJECT_FOR_APPLICATION, data: { applicationId: application.id } } as Job)
      ).rejects.toThrow(`Application does not have a form submission: ${application.id}`);
      const submission = await FormSubmissionFactory.create({ applicationId: application.id, status: "approved" });

      const project = { uuid: uuidv4() } as Project;
      const projectProcessor = createMock<ProjectProcessor>({
        create: jest.fn().mockResolvedValue(project)
      });
      entitiesService.createEntityProcessor.mockReturnValue(projectProcessor);

      await processor.process({ name: CREATE_PROJECT_FOR_APPLICATION, data: { applicationId: application.id } } as Job);
      expect(entitiesService.createEntityProcessor).toHaveBeenCalledWith("projects");
      expect(projectProcessor.create).toHaveBeenCalledWith({ applicationUuid: application.uuid, formUuid: form.uuid });
      expect(emailQueue.add).toHaveBeenCalledWith("formSubmissionFeedback", {
        submissionId: submission.id,
        projectUuid: project.uuid
      });
    });
  });

  describe("generateFrameworkEntityExport", () => {
    it("throws if the framework key or entity type is missing", async () => {
      await expect(
        processor.process({ name: GENERATE_FRAMEWORK_ENTITY_EXPORT, data: { frameworkKey: "terrafund" } } as Job)
      ).rejects.toThrow('Invalid frameworkKey or entityType: {"frameworkKey":"terrafund"}');

      await expect(
        processor.process({ name: GENERATE_FRAMEWORK_ENTITY_EXPORT, data: { entityType: "projects" } } as Job)
      ).rejects.toThrow('Invalid frameworkKey or entityType: {"entityType":"projects"}');
    });

    it("calls exportAll on the processor", async () => {
      const exportAll = jest.fn();
      entitiesService.createEntityProcessor.mockReturnValue({ exportAll } as unknown as ProjectProcessor);
      await processor.process({
        name: GENERATE_FRAMEWORK_ENTITY_EXPORT,
        data: { frameworkKey: "terrafund", entityType: "projects" }
      } as Job);
      expect(exportAll).toHaveBeenCalled();
    });
  });

  describe("generateApplicationExport", () => {
    it("throws if the funding programme id is missing", async () => {
      await expect(processor.process({ name: GENERATE_APPLICATION_EXPORT, data: {} } as Job)).rejects.toThrow(
        "Invalid fundingProgrammeId: {}"
      );
    });

    it("throws if the funding programme is not found", async () => {
      await expect(
        processor.process({ name: GENERATE_APPLICATION_EXPORT, data: { fundingProgrammeId: -1 } } as Job)
      ).rejects.toThrow("Funding programme not found: -1");
    });

    it("calls the service and records a saved export", async () => {
      const fp = await FundingProgrammeFactory.create();
      const name = `${faker.lorem.slug()}.csv`;
      formsService.exportApplications.mockResolvedValue(name);
      await processor.process({ name: GENERATE_APPLICATION_EXPORT, data: { fundingProgrammeId: fp.id } } as Job);
      expect(formsService.exportApplications).toHaveBeenCalledWith(expect.objectContaining({ id: fp.id }));
      const latest = await SavedExport.findOne({ order: [["id", "DESC"]] });
      expect(latest?.name).toBe(name);
      expect(latest?.fundingProgrammeId).toBe(fp.id);
    });
  });
});
