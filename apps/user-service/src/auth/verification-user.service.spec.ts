/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Test, TestingModule } from "@nestjs/testing";
import { User, Verification } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { VerificationUserService } from "./verification-user.service";
import { UserFactory } from "@terramatch-microservices/database/factories";
import { VerificationFactory } from "@terramatch-microservices/database/factories/verification.factory";
import { EmailService } from "@terramatch-microservices/common/email/email.service";
import crypto from "node:crypto";

describe("VerificationUserService", () => {
  let service: VerificationUserService;
  let emailService: EmailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationUserService,
        {
          provide: EmailService,
          useValue: {
            sendI18nTemplateEmail: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<VerificationUserService>(VerificationUserService);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should throw when user is not found", async () => {
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(null));
    await expect(service.verify("my token")).rejects.toThrow(NotFoundException);
  });

  it("should throw when verification is not found", async () => {
    const user = await UserFactory.create();
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    jest.spyOn(Verification, "findOne").mockImplementation(() => Promise.resolve(null));
    await expect(service.verify("my token")).rejects.toThrow(NotFoundException);
  });

  it("should verify an user", async () => {
    const user = await UserFactory.create();
    const verification = await VerificationFactory.create({ userId: user.id });
    verification.user = user;
    jest.spyOn(Verification, "findOne").mockImplementation(() => Promise.resolve(verification));
    const destroySpy = jest.spyOn(verification, "destroy").mockResolvedValue();

    const result = await service.verify(verification.token!);
    expect(user.emailAddressVerifiedAt).toBeDefined();
    expect(destroySpy).toHaveBeenCalled();
    expect(result).toStrictEqual({ uuid: user.uuid, isVerified: true });
  });

  it("should do nothing when user to resend verification for is not found", async () => {
    jest.spyOn(User, "findOne").mockResolvedValue(null);

    await expect(service.resendVerificationEmail("missing@example.com")).resolves.toBeUndefined();
  });

  it("should create a new verification token and send email when user exists", async () => {
    const user = await UserFactory.create({ emailAddress: "user@example.com" });
    const callbackUrl = "https://example.com/verify?token=";
    const tokenBuffer = Buffer.alloc(32, 1);

    jest.spyOn(User, "findOne").mockResolvedValue(user);
    jest.spyOn(crypto, "randomBytes").mockImplementation(() => tokenBuffer as unknown as Buffer);
    const verificationCreateSpy = jest.spyOn(Verification, "create").mockResolvedValue({} as Verification);
    const emailSpy = jest
      .spyOn(emailService, "sendI18nTemplateEmail")
      .mockResolvedValue(Promise.resolve() as unknown as void);

    await service.resendVerificationEmail(user.emailAddress, callbackUrl);

    expect(verificationCreateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        token: tokenBuffer.toString("hex")
      })
    );
    expect(emailSpy).toHaveBeenCalledWith(
      user.emailAddress,
      user.locale,
      expect.any(Object),
      expect.objectContaining({
        additionalValues: expect.objectContaining({
          link: expect.stringContaining(callbackUrl),
          transactional: "transactional"
        })
      })
    );
  });

  it("should skip sending verification email when user has no email address", async () => {
    const user = await UserFactory.create();
    // Simulate missing email address on the persisted user
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (user as any).emailAddress = null;

    jest.spyOn(User, "findOne").mockResolvedValue(user);
    const verificationCreateSpy = jest.spyOn(Verification, "create");
    const emailSpy = jest.spyOn(emailService, "sendI18nTemplateEmail");

    await service.resendVerificationEmail("missing-email@example.com", "https://example.com/verify?token=");

    expect(verificationCreateSpy).not.toHaveBeenCalled();
    expect(emailSpy).not.toHaveBeenCalled();
  });

  it("should use default verify path when callbackUrl is not provided", async () => {
    const user = await UserFactory.create({ emailAddress: "user2@example.com" });
    const tokenBuffer = Buffer.alloc(32, 2);

    jest.spyOn(User, "findOne").mockResolvedValue(user);
    jest.spyOn(crypto, "randomBytes").mockImplementation(() => tokenBuffer as unknown as Buffer);
    jest.spyOn(Verification, "create").mockResolvedValue({} as Verification);
    const emailSpy = jest
      .spyOn(emailService, "sendI18nTemplateEmail")
      .mockResolvedValue(Promise.resolve() as unknown as void);

    await service.resendVerificationEmail(user.emailAddress);

    expect(emailSpy).toHaveBeenCalledWith(
      user.emailAddress,
      user.locale,
      expect.any(Object),
      expect.objectContaining({
        additionalValues: expect.objectContaining({
          link: expect.stringContaining("/verify?token="),
          transactional: "transactional"
        })
      })
    );
  });
});
