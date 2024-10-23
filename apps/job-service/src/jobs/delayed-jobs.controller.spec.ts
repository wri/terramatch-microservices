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
    const { uuid, statusCode, payload } = await DelayedJobFactory.create();
    const result = await controller.findOne(uuid);
    const resource = result.data as Resource;
    expect(resource.type).toBe('delayedJobs');
    expect(resource.id).toBe(uuid);
    expect(resource.attributes.statusCode).toBe(statusCode);
    // TODO This will need an update when `payload` has been converted to a jsonb field
    expect(resource.attributes.payload).toBe(payload);
  });
})
