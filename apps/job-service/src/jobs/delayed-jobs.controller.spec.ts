import { DelayedJobsController } from './delayed-jobs.controller';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { DelayedJobFactory } from '@terramatch-microservices/database/factories';
import { Resource } from '@terramatch-microservices/common/util';
import { DelayedJob } from '@terramatch-microservices/database/entities';
import { JobBulkUpdateBodyDto } from './dto/delayed-job-update.dto';

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

  it('should throw not found if the delayed job does not exist', async () => {
    await expect(controller.findOne('asdf')).rejects
      .toThrow(NotFoundException);
  });

  it('should return the job definition when the delayed job does exist', async () => {
    const { uuid, statusCode, payload, totalContent, processedContent, progressMessage } = await DelayedJobFactory.create();
    const result = await controller.findOne(uuid);
    const resource = result.data as Resource;
    expect(resource.type).toBe('delayedJobs');
    expect(resource.id).toBe(uuid);
    expect(resource.attributes.statusCode).toBe(statusCode);
    expect(resource.attributes.payload).toMatchObject(payload);
    expect(resource.attributes.totalContent).toBe(totalContent);
    expect(resource.attributes.processedContent).toBe(processedContent);
    expect(resource.attributes.progressMessage).toBe(progressMessage);
  });
  describe('bulkClearJobs', () => {
    it('should clear non-pending jobs in bulk for the authenticated user and return the updated jobs', async () => {
      const job1 = await DelayedJobFactory.create({
        createdBy: 130999,
        isAcknowledged: false,
        status: 'completed'
      });
      const job2 = await DelayedJobFactory.create({
        createdBy: 130999,
        isAcknowledged: false,
        status: 'failed'
      });
      const job3 = await DelayedJobFactory.create({
        createdBy: 130999,
        isAcknowledged: false,
        status: 'pending'
      });
  
      const request = { authenticatedUserId: 130999 };
      const payload: JobBulkUpdateBodyDto = {
        data: [
          {
            type: 'jobs',
            uuid: job1.uuid,
            attributes: {
              isAcknowledged: true,
            },
          },
          {
            type: 'jobs',
            uuid: job2.uuid,
            attributes: {
              isAcknowledged: true,
            },
          },
        ],
      };
  
      const result = await controller.bulkClearJobs(payload, request);
  
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        type: 'jobs',
        uuid: job1.uuid,
        attributes: {
          isAcknowledged: true,
        },
      });
      expect(result.data[1]).toMatchObject({
        type: 'jobs',
        uuid: job2.uuid,
        attributes: {
          isAcknowledged: true,
        },
      });
    });
  
    it('should return an empty array when no jobs can be cleared in bulk', async () => {
      const job = await DelayedJobFactory.create({
        createdBy: 130999,
        isAcknowledged: false,
        status: 'pending'
      });
  
      const request = { authenticatedUserId: 130999 };
      const payload: JobBulkUpdateBodyDto = {
        data: [
          {
            type: 'jobs',
            uuid: job.uuid,
            attributes: {
              isAcknowledged: true,
            },
          },
        ],
      };
  
      const result = await controller.bulkClearJobs(payload, request);
  
      expect(result.data).toHaveLength(0);
    });
  });
  

  describe('findOne', () => {
    it('should handle non-existent job uuid', async () => {
      await expect(controller.findOne('non-existent-uuid')).rejects.toThrow(NotFoundException);
    });

    it('should handle null or undefined uuid', async () => {
      await expect(controller.findOne(null)).rejects.toThrow();
      await expect(controller.findOne(undefined)).rejects.toThrow();
    });
  });


  describe('findOne', () => {
    it('should handle non-existent job uuid', async () => {
      await expect(controller.findOne('non-existent-uuid')).rejects.toThrow(NotFoundException);
    });

    it('should handle null or undefined uuid', async () => {
      await expect(controller.findOne(null)).rejects.toThrow();
      await expect(controller.findOne(undefined)).rejects.toThrow();
    });
  });

  describe('getRunningJobs', () => {
    it('should handle jobs with different statuses', async () => {
      const authenticatedUserId = 130999;
      const request = { authenticatedUserId };

      // Create jobs with different statuses but same user
      await DelayedJobFactory.create({
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: 'completed'
      });
      await DelayedJobFactory.create({
        createdBy: authenticatedUserId,
        isAcknowledged: false,
        status: 'pending'
      });
      await DelayedJobFactory.create({
        createdBy: authenticatedUserId,
        isAcknowledged: true,
        status: 'failed'
      });

      const result = await controller.getRunningJobs(request);
      const resources = result.data as Resource[];

      // Should only return non-cleared jobs
      expect(resources).toHaveLength(2);
    });
  });
});
