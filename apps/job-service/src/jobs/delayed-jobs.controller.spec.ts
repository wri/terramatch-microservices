import { DelayedJobsController } from './delayed-jobs.controller';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger, NotFoundException } from '@nestjs/common';
import { DelayedJobFactory } from '@terramatch-microservices/database/factories';
import { Resource } from '@terramatch-microservices/common/util';
import { DelayedJob } from '@terramatch-microservices/database/entities';


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
  })

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

  describe('getRunningJobs', () => {
    it('should return only running jobs for the authenticated user', async () => {
      const authenticatedUserId = '130999';
      const request = { authenticatedUserId };

      await DelayedJobFactory.create({ 
        createdBy: authenticatedUserId,
        isAknowledged: false 
      });
      await DelayedJobFactory.create({ 
        createdBy: authenticatedUserId,
        isAknowledged: false
      });
      await DelayedJobFactory.create({ 
        createdBy: '1388',
        isAknowledged: false
      });

      const result = await controller.getRunningJobs(request);
      const resources = result.data as Resource[];

      expect(resources).toHaveLength(2);
    });

    it('should return an empty array when no running jobs exist', async () => {
      const request = { authenticatedUserId: '181818' };
      const result = await controller.getRunningJobs(request);
      expect(result.data).toHaveLength(0);
    });
  });
  describe('clearNonPendingJobs', () => {
    it('should clear non-pending jobs for the authenticated user', async () => {
      // Create some jobs with different statuses
      await DelayedJobFactory.create({ 
        createdBy: '130999', 
        isAknowledged: false, 
        status: 'completed' 
      });
      await DelayedJobFactory.create({ 
        createdBy: '130999', 
        isAknowledged: false, 
        status: 'failed' 
      });
      await DelayedJobFactory.create({ 
        createdBy: '130999', 
        isAknowledged: false, 
        status: 'pending' 
      });
      await DelayedJobFactory.create({ 
        createdBy: '999999', 
        isAknowledged: false, 
        status: 'completed' 
      });

      const request = { authenticatedUserId: '130999' };
      const result = await controller.clearNonPendingJobs(request);

      expect(result.message).toBe('2 jobs have been cleared.');
    });

    it('should return 0 when no jobs can be cleared', async () => {
      await DelayedJobFactory.create({ 
        createdBy: '130999', 
        isAknowledged: false, 
        status: 'pending' 
      });

      const request = { authenticatedUserId: '130999' };
      const result = await controller.clearNonPendingJobs(request);

      expect(result.message).toBe('0 jobs have been cleared.');
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
      const authenticatedUserId = '130999';
      const request = { authenticatedUserId };

      // Create jobs with different statuses but same user
      await DelayedJobFactory.create({ 
        createdBy: authenticatedUserId,
        isAknowledged: false,
        status: 'completed'
      });
      await DelayedJobFactory.create({ 
        createdBy: authenticatedUserId,
        isAknowledged: false,
        status: 'pending'
      });
      await DelayedJobFactory.create({ 
        createdBy: authenticatedUserId,
        isAknowledged: true,
        status: 'failed'
      });

      const result = await controller.getRunningJobs(request);
      const resources = result.data as Resource[];

      // Should only return non-cleared jobs
      expect(resources).toHaveLength(2);
    });
  });
});