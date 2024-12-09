import { DelayedJobsController } from './delayed-jobs.controller';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DelayedJobFactory } from '@terramatch-microservices/database/factories';
import { Resource } from '@terramatch-microservices/common/util';

describe('DelayedJobsController', () => {
  let controller: DelayedJobsController;

  beforeEach(async () => {
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
      const authenticatedUserId = '123';
      const request = { authenticatedUserId };

      // Create some test jobs
      const userJob1 = await DelayedJobFactory.create({ 
        createdBy: authenticatedUserId,
        isCleared: false 
      });
      const userJob2 = await DelayedJobFactory.create({ 
        createdBy: authenticatedUserId,
        isCleared: false
      });
      // Create a job for a different user
      await DelayedJobFactory.create({ 
        createdBy: '456',
        isCleared: false
      });
      // Create a cleared job for the authenticated user
      await DelayedJobFactory.create({ 
        createdBy: authenticatedUserId,
        isCleared: true
      });

      const result = await controller.getRunningJobs(request);
      const resources = result.data as Resource[];

      expect(resources).toHaveLength(2);
      expect(resources[0].type).toBe('delayedJobs');
      expect(resources[1].type).toBe('delayedJobs');
      
      // Should be ordered by createdAt DESC
      const jobIds = resources.map(r => r.id);
      expect(jobIds).toContain(userJob1.uuid);
      expect(jobIds).toContain(userJob2.uuid);

      // Verify job attributes
      resources.forEach(resource => {
        expect(resource.attributes.isCleared).toBe(0);
        expect(resource.attributes.createdBy).toBe(authenticatedUserId);
      });
    });

    it('should return an empty array when no running jobs exist', async () => {
      const request = { authenticatedUserId: 123 };
      const result = await controller.getRunningJobs(request);
      expect(result.data).toHaveLength(0);
    });
  });
});