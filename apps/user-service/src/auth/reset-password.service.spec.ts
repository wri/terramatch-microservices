import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { PasswordReset, User } from "@terramatch-microservices/database/entities";
import { UserFactory } from "@terramatch-microservices/database/factories";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import { ResetPasswordService } from "./reset-password.service";
import { NotFoundException } from "@nestjs/common";
import { LocalizationKeyFactory } from "@terramatch-microservices/database/factories/localization-key.factory";
import { LocalizationService } from "@terramatch-microservices/common/localization/localization.service";
import { TemplateService } from "@terramatch-microservices/common/templates/template.service";

describe("ResetPasswordService", () => {
  let service: ResetPasswordService;
  let jwtService: DeepMocked<JwtService>;
  let emailService: DeepMocked<EmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResetPasswordService,
        {
          provide: JwtService,
          useValue: (jwtService = createMock<JwtService>())
        },
        {
          provide: EmailService,
          useValue: (emailService = createMock<EmailService>())
        },
        {
          provide: LocalizationService,
          useValue: createMock<LocalizationService>()
        },
        {
          provide: TemplateService,
          useValue: createMock<TemplateService>()
        }
      ]
    }).compile();

    service = module.get<ResetPasswordService>(ResetPasswordService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw when user is not found", async () => {
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null));
    await expect(
      service.sendResetPasswordEmail("user@gmail.com", "https://example.com/auth/reset-password")
    ).rejects.toThrow(NotFoundException);
  });

  it("should send a reset password email to the user", async () => {
    const user = await UserFactory.create();
    await LocalizationKeyFactory.create({
      key: "reset-password.body",
      value: "Reset your password by clicking on the following link: link"
    });
    await LocalizationKeyFactory.create({
      key: "reset-password.subject",
      value: "Reset Password"
    });
    await LocalizationKeyFactory.create({
      key: "reset-password.title",
      value: "Reset Password"
    });
    await LocalizationKeyFactory.create({
      key: "reset-password.cta",
      value: "Reset Password"
    });

    const token = "fake token";
    jwtService.signAsync.mockReturnValue(Promise.resolve(token));

    emailService.sendI18nTemplateEmail.mockReturnValue(Promise.resolve());

    const result = await service.sendResetPasswordEmail(user.emailAddress, "https://example.com/auth/reset-password");
    expect(jwtService.signAsync).toHaveBeenCalled();
    expect(emailService.sendI18nTemplateEmail).toHaveBeenCalled();
    expect(result).toStrictEqual({ email: user.emailAddress, uuid: user.uuid });
  });

  it("should an error user not found", async () => {
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null));
    const newPassword = "abc282821";
    await expect(service.resetPassword("fake", newPassword)).rejects.toThrow(new NotFoundException("User not found"));
  });

  it("should reset password user", async () => {
    const user = await UserFactory.create();
    const newPassword = "abc282821";
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    const token = await jwtService.signAsync({ sub: user.uuid }, { expiresIn: "2h" });
    const result = await service.resetPassword(token, newPassword);
    expect(jwtService.verifyAsync).toHaveBeenCalled();
    expect(result).toStrictEqual({ email: user.emailAddress, uuid: user.uuid });
  });

  describe("getResetPassword", () => {
    it("should return tokenUsed true when no password reset exists for the token", async () => {
      jest.spyOn(PasswordReset, "findOne").mockResolvedValue(null);

      const result = await service.getResetPassword("unknown-token");

      expect(result).toStrictEqual({ emailAddress: null, uuid: null, tokenUsed: true });
    });

    it("should destroy expired reset and return tokenUsed true", async () => {
      const createdAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const passwordReset = {
        id: 1,
        token: "expired-token",
        userId: 99,
        createdAt
      } as PasswordReset;
      jest.spyOn(PasswordReset, "findOne").mockResolvedValue(passwordReset);
      const destroySpy = jest.spyOn(PasswordReset, "destroy").mockResolvedValue(1);

      const result = await service.getResetPassword("expired-token");

      expect(destroySpy).toHaveBeenCalledWith({ where: { id: passwordReset.id } });
      expect(result).toStrictEqual({ emailAddress: null, uuid: null, tokenUsed: true });
    });

    it("should return user details when token is valid and within retention", async () => {
      const user = await UserFactory.create();
      const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const passwordReset = {
        id: 2,
        token: "valid-token",
        userId: user.id,
        createdAt
      } as PasswordReset;
      jest.spyOn(PasswordReset, "findOne").mockResolvedValue(passwordReset);

      const result = await service.getResetPassword("valid-token");

      expect(result).toStrictEqual({
        emailAddress: user.emailAddress,
        uuid: user.uuid,
        locale: user.locale,
        tokenUsed: false
      });
    });

    it("should throw NotFoundException when reset exists but user is missing", async () => {
      const createdAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const passwordReset = {
        id: 3,
        token: "orphan-token",
        userId: 9_999_999,
        createdAt
      } as PasswordReset;
      jest.spyOn(PasswordReset, "findOne").mockResolvedValue(passwordReset);
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      await expect(service.getResetPassword("orphan-token")).rejects.toThrow(new NotFoundException("User not found"));
    });
  });
});
