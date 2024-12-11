import { Test, TestingModule } from '@nestjs/testing';
import { DelayedJobsController } from './delayed-jobs.controller';
import { DelayedJob } from '@terramatch-microservices/database/entities';
import { DelayedJobBulkUpdateBodyDto } from './dto/delayed-job-update.dto';
import { v4 as uuidv4 } from 'uuid';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';

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

  describe('bulkClearJobs', () => {
    it('should successfully clear multiple jobs', async () => {
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

      const result = await controller.bulkClearJobs(payload, request);
      
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(job1.uuid);
      expect(result.data[1].id).toBe(job2.uuid);

      const updatedJob1 = await DelayedJob.findOne({ where: { uuid: job1.uuid } });
      const updatedJob2 = await DelayedJob.findOne({ where: { uuid: job2.uuid } });
      expect(updatedJob1.isAcknowledged).toBe(true);
      expect(updatedJob2.isAcknowledged).toBe(true);
    });

    it('should throw BadRequestException when no jobs are provided', async () => {
      const payload: DelayedJobBulkUpdateBodyDto = { data: [] };
      const request = { authenticatedUserId: 130999 };

      await expect(controller.bulkClearJobs(payload, request))
        .rejects.toThrow(BadRequestException);
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

      await expect(controller.bulkClearJobs(payload, request))
        .rejects.toThrow(NotFoundException);
    });

    it('should not update jobs created by other users', async () => {
      const authenticatedUserId = 130999;
      const otherUserId = 999999;

      const otherUserJob = await DelayedJob.create({
        uuid: uuidv4(),
        createdBy: otherUserId,
        isAcknowledged: false,
        status: 'completed'
      });

      const payload: DelayedJobBulkUpdateBodyDto = {
        data: [
          {
            type: 'delayedJobs',
            uuid: otherUserJob.uuid,
            attributes: { isAcknowledged: true }
          }
        ]
      };
      const request = { authenticatedUserId };

      await expect(controller.bulkClearJobs(payload, request))
        .rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException for missing authenticated id', async () => {
      const payload: DelayedJobBulkUpdateBodyDto = {
        data: [
          { type: 'delayedJobs', uuid: uuidv4(), attributes: { isAcknowledged: true } }
        ]
      };

      await expect(controller.bulkClearJobs(payload, { authenticatedUserId: null }))
        .rejects.toThrow(UnauthorizedException);
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

      await expect(controller.bulkClearJobs(payload, request))
        .rejects.toThrow(NotFoundException);
    });
  });
});
