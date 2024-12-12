import { Test, TestingModule } from '@nestjs/testing';
import { DelayedJobsController } from './delayed-jobs.controller';
import { DelayedJob } from '@terramatch-microservices/database/entities';
import { DelayedJobBulkUpdateBodyDto, DelayedJobAttributes, DelayedJobData } from './dto/delayed-job-update.dto';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundException } from '@nestjs/common';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';

describe('DelayedJobsController', () => {
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

  describe('getRunningJobs', () => {
    it('should return a list of running jobs for the authenticated user', async () => {
      const authenticatedUserId = 130999;
      
      const job = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: 'completed',
      });
      const request = {
        authenticatedUserId,
      };
  
      const result = await controller.getRunningJobs(request);
  
      const data = Array.isArray(result.data) ? result.data : [result.data];
  
      expect(data).toHaveLength(1);
      expect(data[0].id).toBe(job.uuid);
    });
    it('should return an empty list when there are no running jobs', async () => {
      const authenticatedUserId = 130999;
      const request = { authenticatedUserId };
      
      const result = await controller.getRunningJobs(request);
      expect(result.data).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a job by UUID', async () => {
      const authenticatedUserId = 130999;
      const job = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: 'completed'
      });
  
      const result = await controller.findOne(job.uuid);
      const jobData = Array.isArray(result.data) ? result.data[0] : result.data;
      expect(jobData.id).toBe(job.uuid);
    });
    it('should throw NotFoundException when the job does not exist', async () => {
      const nonExistentUuid = uuidv4();
      
      await expect(controller.findOne(nonExistentUuid)).rejects.toThrow(NotFoundException);
    });
    
  });

  describe('bulkUdpateJobs', () => {
    it('should successfully bulk update jobs to acknowledged', async () => {
      const authenticatedUserId = 130999;
      const job1 = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: 'completed'
      });
      const job2 = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: 'failed'
      });

      const payload: DelayedJobBulkUpdateBodyDto = {
        data: [
          {
            type: 'delayedJobs',
            uuid: job1.uuid,
            attributes: { isAcknowledged: true }
          },
          {
            type: 'delayedJobs',
            uuid: job2.uuid,
            attributes: { isAcknowledged: true }
          }
        ]
      };

      const request = { authenticatedUserId };

      const result = await controller.bulkUpdateJobs(payload, request);

      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(job1.uuid);
      expect(result.data[1].id).toBe(job2.uuid);

      const updatedJob1 = await DelayedJob.findOne({ where: { uuid: job1.uuid } });
      const updatedJob2 = await DelayedJob.findOne({ where: { uuid: job2.uuid } });
      expect(updatedJob1.isAcknowledged).toBe(true);
      expect(updatedJob2.isAcknowledged).toBe(true);
    });

    it('should throw NotFoundException for non-existent job', async () => {
      const payload: DelayedJobBulkUpdateBodyDto = {
        data: [
          {
            type: 'delayedJobs',
            uuid: 'non-existent-uuid',
            attributes: { isAcknowledged: true }
          }
        ]
      };
      const request = { authenticatedUserId: 130999 };

      await expect(controller.bulkUpdateJobs(payload, request))
        .rejects.toThrow(NotFoundException);
    });

    it('should not update jobs with status "pending"', async () => {
      const authenticatedUserId = 130999;
      const pendingJob = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: 'pending'
      });

      const payload: DelayedJobBulkUpdateBodyDto = {
        data: [
          {
            type: 'delayedJobs',
            uuid: pendingJob.uuid,
            attributes: { isAcknowledged: true }
          }
        ]
      };
      const request = { authenticatedUserId };

      await expect(controller.bulkUpdateJobs(payload, request))
        .rejects.toThrow(NotFoundException);
    });
    
  });
  describe('DelayedJobAttributes', () => {
    it('should require an array of DelayedJobData', async () => {
      const invalidData = {
        data: 'not an array'
      };

      const invalidInstance = plainToClass(DelayedJobBulkUpdateBodyDto, invalidData);
      const invalidResult = await validate(invalidInstance);

      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].constraints).toHaveProperty('isArray');
    });
    it('should validate nested DelayedJobAttributes', async () => {
      const validData = {
        type: 'delayedJobs',
        uuid: uuidv4(),
        attributes: { isAcknowledged: true }
      };
    
      const invalidData = {
        type: 'delayedJobs',
        uuid: uuidv4(),
        attributes: { 
          isAcknowledged: 'not a boolean' 
        }
      };
    
      const validInstance = plainToClass(DelayedJobData, validData);
      const validResult = await validate(validInstance);
      expect(validResult).toHaveLength(0);
      const invalidInstance = plainToClass(DelayedJobData, invalidData);
      const invalidResult = await validate(invalidInstance);
      expect(invalidResult).toHaveLength(1);
      expect(invalidResult[0].property).toBe('attributes');
      const nestedErrors = invalidResult[0].children;
      expect(nestedErrors).toHaveLength(1);
      expect(nestedErrors[0].constraints).toHaveProperty('isBoolean');
    });
  });
});
