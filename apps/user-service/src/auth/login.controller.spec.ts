import { Test, TestingModule } from '@nestjs/testing';
import { LoginController } from './login.controller';
import { AuthService } from './auth.service';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { UnauthorizedException } from '@nestjs/common';

describe('LoginController', () => {
  let controller: LoginController;
  let authService: DeepMocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LoginController],
      providers: [
        { provide: AuthService, useValue: authService = createMock<AuthService>() },
      ],
    }).compile();

    controller = module.get<LoginController>(LoginController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  it('should throw if creds are invalid', async () => {
    authService.login.mockResolvedValue(null);

    await expect(() => controller.create({ emailAddress: 'foo@bar.com', password: 'asdfasdfasdf' }))
      .rejects
      .toThrow(UnauthorizedException)
  })

  it('returns a token if creds are valid', async () => {
    const token = 'fake jwt token';
    const userId = 123;
    authService.login.mockResolvedValue({ token, userId })

    const result = await controller.create({ emailAddress: 'foo@bar.com', password: 'asdfasdfasdf' });
    expect(result).toMatchObject({ data: { id: `${userId}`, type: 'logins', attributes: { token } } });
  })
});
