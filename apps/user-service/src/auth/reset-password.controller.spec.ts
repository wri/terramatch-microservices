import { Test, TestingModule } from '@nestjs/testing';
import { createMock, DeepMocked } from '@golevelup/ts-jest';
import { ResetPasswordController } from "./reset-password.controller";
import { ResetPasswordService } from "./reset-password.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe('ResetPasswordController', () => {
  let controller: ResetPasswordController;
  let resetPasswordService: DeepMocked<ResetPasswordService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResetPasswordController],
      providers: [
        { provide: ResetPasswordService, useValue: resetPasswordService = createMock<ResetPasswordService>() },
      ],
    }).compile();

    controller = module.get<ResetPasswordController>(ResetPasswordController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  })

  it('should send a password reset email', async () => {
    const email = 'user1@example.com';
    const uuid = '620f0002-aa04-42c0-b7bd-69e80790fbb5';
    const userId = 19191;
    resetPasswordService.sendResetPasswordEmail.mockResolvedValue({ userId, email, uuid });

    const result = await controller.requestReset({ emailAddress: email, callbackUrl: 'http://example.com' });
    expect(result).toMatchObject({ data: { id: `${userId}`, type: 'logins', attributes: {  emailAddress: email, uuid } } });
  });

  it('should throw NotFoundException if user is not found', async () => {
    const email1 = 'user1@example.com';
    resetPasswordService.sendResetPasswordEmail.mockRejectedValue(new NotFoundException('User not found'));

    await expect(controller.requestReset({ emailAddress: email1, callbackUrl: 'http://example.com' })).rejects.toThrow(NotFoundException);
  });

  it('should throw NotFoundException if localization is not found', async () => {
    const email1 = 'user1@example.com';
    resetPasswordService.sendResetPasswordEmail.mockRejectedValue(new NotFoundException('Localization not found'));

    await expect(controller.requestReset({ emailAddress: email1, callbackUrl: 'http://example.com' })).rejects.toThrow(NotFoundException);
  });

  it('should reset password', async () => {
    const email = 'user1@example.com';
    const uuid = '620f0002-aa04-42c0-b7bd-69e80790fbb5';
    const userId = 19191;
    resetPasswordService.resetPassword.mockResolvedValue({ userId, email, uuid });
    const token = 'fake'

    const result = await controller.resetPassword(token, { newPassword : 'superpassword'});
    expect(result).toMatchObject({ data: { id: `${userId}`, type: 'logins', attributes: {  emailAddress: email, uuid } } });
  });

  it('should throw NotFoundException if user is not found', async () => {
    const token = 'fake'
    resetPasswordService.resetPassword.mockRejectedValue(new NotFoundException('User not found'));

    await expect(controller.resetPassword(token, { newPassword : 'superpassword'})).rejects.toThrow(NotFoundException);
  });

  it('should throw BadRequestException if token is invalid/expired', async () => {
    const token = 'fake'
    resetPasswordService.resetPassword.mockRejectedValue(new BadRequestException('Provided token is invalid or expired'));

    await expect(controller.resetPassword(token, { newPassword : 'superpassword'})).rejects.toThrow(BadRequestException);
  });

});
