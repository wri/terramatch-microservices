import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { PolicyService } from '@terramatch-microservices/common';
import { createMock, DeepMocked } from '@golevelup/ts-jest';

describe('UsersController', () => {
  let controller: UsersController;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: PolicyService, useValue: policyService = createMock<PolicyService>() },
      ]
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
