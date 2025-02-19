import { Test, TestingModule } from "@nestjs/testing";
import { DelayedJobsController } from "./delayed-jobs.controller";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { DelayedJobBulkUpdateBodyDto, DelayedJobData } from "./dto/delayed-job-update.dto";
import { v4 as uuidv4 } from "uuid";
import { NotFoundException } from "@nestjs/common";
import { plainToClass } from "class-transformer";
import { validate } from "class-validator";

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

      const job = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: "completed",
        metadata: null
      });

      const request = { authenticatedUserId };
      const result = await controller.getRunningJobs(request);

      const data = Array.isArray(result.data) ? result.data : [result.data];

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(job.uuid);
      expect(data[0].attributes.entityName).toBeUndefined();
    });
    it("should return a job with entity_name if metadata exists", async () => {
      const authenticatedUserId = 130999;

      const job = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: "completed",
        metadata: { entity_name: "TestEntity" }
      });

      const request = { authenticatedUserId };
      const result = await controller.getRunningJobs(request);

      const data = Array.isArray(result.data) ? result.data : [result.data];

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(job.uuid);

      const entityName = data[0].attributes.entityName;
      expect(entityName).toBe("TestEntity");
    });

    it("should return a job with null entity_name if metadata does not have entity_name", async () => {
      const authenticatedUserId = 130999;

      const job = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: "completed",
        metadata: {}
      });

      const request = { authenticatedUserId };
      const result = await controller.getRunningJobs(request);

      const data = Array.isArray(result.data) ? result.data : [result.data];

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(job.uuid);

      const entityName = data[0].attributes.entityName;
      expect(entityName).toBeUndefined();
    });
  });

  describe("findOne", () => {
    it("should return a job by UUID with entity_name", async () => {
      const authenticatedUserId = 130999;
      const job = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: "completed",
        metadata: { entity_name: "TestEntity" } // Adding entity_name
      });

      const result = await controller.findOne(job.uuid);
      const jobData = Array.isArray(result.data) ? result.data[0] : result.data;
      expect(jobData.id).toBe(job.uuid);
    });
    it("should throw NotFoundException when the job does not exist", async () => {
      const nonExistentUuid = uuidv4();

      await expect(controller.findOne(nonExistentUuid)).rejects.toThrow(NotFoundException);
    });
  });

  describe("bulkUdpateJobs", () => {
    let controller: DelayedJobsController;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        controllers: [DelayedJobsController],
        providers: []
      }).compile();

      controller = module.get<DelayedJobsController>(DelayedJobsController);
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it("should update a single job successfully", async () => {
      const authenticatedUserId = "user-123";
      const jobUpdateDto: DelayedJobBulkUpdateBodyDto = {
        data: [{ type: "delayedJobs", uuid: "job-1", attributes: { isAcknowledged: true } }]
      };

      const jobMock = {
        uuid: "job-1",
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        save: jest.fn().mockResolvedValue(undefined),
        toJSON: jest.fn().mockReturnValue({ uuid: "job-1", isAcknowledged: true })
      };

      DelayedJob.findAll = jest.fn().mockResolvedValue([jobMock]);

      const result = await controller.bulkUpdateJobs(jobUpdateDto, { authenticatedUserId });
      expect(result.data[0].attributes.isAcknowledged).toBe(true);
    });

    it("should update multiple jobs successfully", async () => {
      const authenticatedUserId = "user-123";
      const jobUpdateDto: DelayedJobBulkUpdateBodyDto = {
        data: [
          { type: "delayedJobs", uuid: "job-1", attributes: { isAcknowledged: true } },
          { type: "delayedJobs", uuid: "job-2", attributes: { isAcknowledged: false } }
        ]
      };

      const jobMocks = [
        {
          uuid: "job-1",
          createdBy: authenticatedUserId,
          isAcknowledged: false,
          status: "running",
          save: jest.fn().mockResolvedValue(undefined),
          toJSON: jest.fn().mockReturnValue({ uuid: "job-1", isAcknowledged: true })
        },
        {
          uuid: "job-2",
          createdBy: authenticatedUserId,
          isAcknowledged: true,
          status: "completed",
          save: jest.fn().mockResolvedValue(undefined),
          toJSON: jest.fn().mockReturnValue({ uuid: "job-2", isAcknowledged: false })
        }
      ];

      DelayedJob.findAll = jest.fn().mockResolvedValue(jobMocks);

      const result = await controller.bulkUpdateJobs(jobUpdateDto, { authenticatedUserId });
      const data = Array.isArray(result.data) ? result.data : [result.data];
      expect(data.length).toBe(2);
    });

    it("should throw NotFoundException when some jobs are missing", async () => {
      const authenticatedUserId = "user-123";
      const jobUpdateDto: DelayedJobBulkUpdateBodyDto = {
        data: [
          { type: "delayedJobs", uuid: "job-1", attributes: { isAcknowledged: true } },
          { type: "delayedJobs", uuid: "job-2", attributes: { isAcknowledged: false } }
        ]
      };

      DelayedJob.findAll = jest.fn().mockResolvedValue([{ uuid: "job-1", createdBy: authenticatedUserId }]);

      await expect(controller.bulkUpdateJobs(jobUpdateDto, { authenticatedUserId })).rejects.toThrow(NotFoundException);
    });

    it("should throw NotFoundException when trying to update jobs from another user", async () => {
      const authenticatedUserId = "user-123";

      const jobUpdateDto: DelayedJobBulkUpdateBodyDto = {
        data: [{ type: "delayedJobs", uuid: "job-1", attributes: { isAcknowledged: true } }]
      };

      DelayedJob.findAll = jest.fn().mockResolvedValue([{ uuid: "job-1", createdBy: "user-456" }]);

      await expect(controller.bulkUpdateJobs(jobUpdateDto, { authenticatedUserId })).rejects.toThrow(NotFoundException);
    });

    it('should not update jobs if more than one has status "pending"', async () => {
      const authenticatedUserId = "user-123";
      const jobUpdateDto: DelayedJobBulkUpdateBodyDto = {
        data: [
          { type: "delayedJobs", uuid: "job-1", attributes: { isAcknowledged: true } },
          { type: "delayedJobs", uuid: "job-2", attributes: { isAcknowledged: false } }
        ]
      };

      const jobMocks = [
        {
          uuid: "job-1",
          createdBy: authenticatedUserId,
          status: "pending",
          save: jest.fn()
        },
        {
          uuid: "job-2",
          createdBy: authenticatedUserId,
          status: "failed",
          save: jest.fn()
        }
      ];

      DelayedJob.findAll = jest.fn().mockResolvedValue(jobMocks);

      await expect(controller.bulkUpdateJobs(jobUpdateDto, { authenticatedUserId })).rejects.toThrow(NotFoundException);
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
      expect(nestedErrors[0].constraints).toHaveProperty("isBoolean");
    });
  });
});
