/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Test, TestingModule } from "@nestjs/testing";
import { DelayedJobsController } from "./delayed-jobs.controller";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { DelayedJobBulkUpdateBodyDto, DelayedJobData } from "./dto/delayed-job-update.dto";
import { v4 as uuidv4 } from "uuid";
import { NotFoundException } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { validate } from "class-validator";
import { mockUserId, serialize } from "@terramatch-microservices/common/util/testing";
import { DelayedJobFactory } from "@terramatch-microservices/database/factories";

describe("DelayedJobsController", () => {
  let controller: DelayedJobsController;

  beforeEach(async () => {
    await DelayedJob.destroy({
      where: {},
      truncate: true
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DelayedJobsController]
    }).compile();

    controller = module.get<DelayedJobsController>(DelayedJobsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("getRunningJobs", () => {
    it("should return a job with null entity_name if metadata is null", async () => {
      const authenticatedUserId = 130999;
      mockUserId(authenticatedUserId);
      const job = await DelayedJobFactory.succeeded.create({ createdBy: authenticatedUserId });
      const result = serialize(await controller.getRunningJobs());

      const data = Array.isArray(result.data) ? result.data : [result.data];

      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe(job.uuid);
      expect(data[0]?.attributes.entityName).toBeUndefined();
    });

    it("should return a job with entity_name if metadata exists", async () => {
      const authenticatedUserId = 130999;
      mockUserId(authenticatedUserId);
      const job = await DelayedJobFactory.succeeded.create({
        createdBy: authenticatedUserId,
        metadata: { entity_name: "TestEntity" }
      });
      const result = serialize(await controller.getRunningJobs());

      const data = Array.isArray(result.data) ? result.data : [result.data];

      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe(job.uuid);

      const entityName = data[0]?.attributes.entityName;
      expect(entityName).toBe("TestEntity");
    });

    it("should return a job with null entity_name if metadata does not have entity_name", async () => {
      const authenticatedUserId = 130999;
      mockUserId(authenticatedUserId);
      const job = await DelayedJobFactory.succeeded.create({ createdBy: authenticatedUserId, metadata: {} });
      const result = serialize(await controller.getRunningJobs());
      const data = Array.isArray(result.data) ? result.data : [result.data];

      expect(data).toHaveLength(1);
      expect(data[0]?.id).toBe(job.uuid);

      const entityName = data[0]?.attributes.entityName;
      expect(entityName).toBeUndefined();
    });
  });

  describe("findOne", () => {
    it("should return a job by UUID with entity_name", async () => {
      const authenticatedUserId = 130999;
      const job = await DelayedJobFactory.succeeded.create({
        createdBy: authenticatedUserId,
        metadata: { entity_name: "TestEntity" }
      });
      const result = serialize(await controller.findOne(job.uuid));
      const jobData = Array.isArray(result.data) ? result.data[0] : result.data;
      expect(jobData?.id).toBe(job.uuid);
    });

    it("should throw NotFoundException when the job does not exist", async () => {
      const nonExistentUuid = uuidv4();

      await expect(controller.findOne(nonExistentUuid)).rejects.toThrow(NotFoundException);
    });
  });

  describe("bulkUdpateJobs", () => {
    it("should successfully update jobs with null metadata", async () => {
      const authenticatedUserId = 130999;
      mockUserId(authenticatedUserId);
      const job1 = await DelayedJobFactory.succeeded.create({ createdBy: authenticatedUserId });
      const job2 = await DelayedJobFactory.succeeded.create({
        createdBy: authenticatedUserId,
        metadata: { entity_name: "TestEntity1" }
      });
      const payload: DelayedJobBulkUpdateBodyDto = {
        data: [
          {
            type: "delayedJobs",
            uuid: job1.uuid,
            attributes: { isAcknowledged: true }
          },
          {
            type: "delayedJobs",
            uuid: job2.uuid,
            attributes: { isAcknowledged: true }
          }
        ]
      };

      const result = serialize(await controller.bulkUpdateJobs(payload));
      expect(result.data).toHaveLength(2);
      expect(result.data![0].id).toBe(job1.uuid);
      expect(result.data![0].attributes.entityName).toBeUndefined();
      expect(result.data![1].id).toBe(job2.uuid);
      expect(result.data![1].attributes.entityName).toBe("TestEntity1");

      const updatedJob = await DelayedJob.findOne({ where: { uuid: job1.uuid } });
      expect(updatedJob?.isAcknowledged).toBe(true);
    });

    it("should successfully bulk update jobs to acknowledged with entity_name", async () => {
      const authenticatedUserId = 130999;
      mockUserId(authenticatedUserId);
      const job1 = await DelayedJobFactory.succeeded.create({
        createdBy: authenticatedUserId,
        metadata: { entity_name: "TestEntity1" } // Adding entity_name
      });
      const job2 = await DelayedJobFactory.failed.create({
        createdBy: authenticatedUserId,
        metadata: { entity_name: "TestEntity2" } // Adding entity_name
      });

      const payload: DelayedJobBulkUpdateBodyDto = {
        data: [
          {
            type: "delayedJobs",
            uuid: job1.uuid,
            attributes: { isAcknowledged: true }
          },
          {
            type: "delayedJobs",
            uuid: job2.uuid,
            attributes: { isAcknowledged: true }
          }
        ]
      };

      const result = serialize(await controller.bulkUpdateJobs(payload));
      expect(result.data).toHaveLength(2);
      expect(result.data![0].id).toBe(job1.uuid);
      expect(result.data![1].id).toBe(job2.uuid);
      expect(result.data![0].attributes.entityName).toBe("TestEntity1"); // Check entity_name for job1
      expect(result.data![1].attributes.entityName).toBe("TestEntity2"); // Check entity_name for job2

      const updatedJob1 = await DelayedJob.findOne({ where: { uuid: job1.uuid } });
      const updatedJob2 = await DelayedJob.findOne({ where: { uuid: job2.uuid } });
      expect(updatedJob1?.isAcknowledged).toBe(true);
      expect(updatedJob2?.isAcknowledged).toBe(true);
    });

    it("should throw NotFoundException for non-existent job", async () => {
      const payload: DelayedJobBulkUpdateBodyDto = {
        data: [
          {
            type: "delayedJobs",
            uuid: "non-existent-uuid",
            attributes: { isAcknowledged: true }
          }
        ]
      };
      mockUserId(130999);

      await expect(controller.bulkUpdateJobs(payload)).rejects.toThrow(NotFoundException);
    });

    it('should update jobs with status "pending"', async () => {
      const authenticatedUserId = 130999;
      mockUserId(authenticatedUserId);
      const pendingJob = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: "pending",
        metadata: { entity_name: "TestEntityPending" } // Adding entity_name
      } as DelayedJob);

      const pendingJob2 = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: "pending",
        metadata: { entity_name: "TestEntityPending2" } // Adding entity_name
      } as DelayedJob);

      const payload: DelayedJobBulkUpdateBodyDto = {
        data: [
          {
            type: "delayedJobs",
            uuid: pendingJob.uuid,
            attributes: { isAcknowledged: true }
          },
          {
            type: "delayedJobs",
            uuid: pendingJob2.uuid,
            attributes: { isAcknowledged: true }
          }
        ]
      };

      const result = serialize(await controller.bulkUpdateJobs(payload));
      expect(result.data).toHaveLength(2);
      expect(result.data![0].id).toBe(pendingJob.uuid);
      expect(result.data![0].attributes.entityName).toBe("TestEntityPending");
      expect(result.data![1].id).toBe(pendingJob2.uuid);
      expect(result.data![1].attributes.entityName).toBe("TestEntityPending2");
    });
  });

  describe("DelayedJobAttributes", () => {
    it("should require an array of DelayedJobData", async () => {
      const invalidData = {
        data: "not an array"
      };

      const invalidInstance = plainToClass(DelayedJobBulkUpdateBodyDto, invalidData);
      const invalidResult = await validate(invalidInstance);

      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].constraints).toHaveProperty("isArray");
    });

    it("should validate nested DelayedJobAttributes", async () => {
      const validData = {
        type: "delayedJobs",
        uuid: uuidv4(),
        attributes: { isAcknowledged: true }
      };

      const invalidData = {
        type: "delayedJobs",
        uuid: uuidv4(),
        attributes: {
          isAcknowledged: "not a boolean"
        }
      };

      const validInstance = plainToClass(DelayedJobData, validData);
      const validResult = await validate(validInstance);
      expect(validResult).toHaveLength(0);
      const invalidInstance = plainToClass(DelayedJobData, invalidData);
      const invalidResult = await validate(invalidInstance);
      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].property).toBe("attributes");
      const nestedErrors = invalidResult[0].children;
      expect(nestedErrors).toHaveLength(1);
      expect(nestedErrors![0].constraints).toHaveProperty("isBoolean");
    });
  });
});
