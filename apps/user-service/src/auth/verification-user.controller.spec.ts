import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { faker } from "@faker-js/faker";
import { VerificationUserController } from "./verification-user.controller";
import { VerificationUserService } from "./verification-user.service";
import { serialize } from "@terramatch-microservices/common/util/testing";

describe("VerificationUserController", () => {
  let controller: VerificationUserController;
  let verificationUserService: DeepMocked<VerificationUserService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VerificationUserController],
      providers: [
        {
          provide: VerificationUserService,
          useValue: (verificationUserService = createMock<VerificationUserService>())
        }
      ]
    }).compile();

    controller = module.get<VerificationUserController>(VerificationUserController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should successfully verify a user when token is valid", async () => {
    const uuid = faker.string.uuid();
    verificationUserService.verify.mockResolvedValue({ uuid, isVerified: true });

    const result = serialize(await controller.verifyUser({ token: "my token" }));
    expect(result).toMatchObject({
      data: { id: uuid, type: "verifications", attributes: { verified: true } }
    });
  });

  it("should throw NotFoundException if verification is not found", async () => {
    verificationUserService.verify.mockRejectedValue(new NotFoundException("Verification not found"));

    await expect(controller.verifyUser({ token: "my token" })).rejects.toThrow(
      new NotFoundException("Verification not found")
    );
  });

  it("should throw NotFoundException if user is not found", async () => {
    verificationUserService.verify.mockRejectedValue(new NotFoundException("User not found"));

    await expect(controller.verifyUser({ token: "my token" })).rejects.toThrow(new NotFoundException("User not found"));
  });

  it("should resend verification email and respond with emailAddress", async () => {
    const emailAddress = faker.internet.email();
    const callbackUrl = "https://example.com/verify?token=";

    verificationUserService.resendVerificationEmail.mockResolvedValue();

    const result = serialize(await controller.resendVerification({ emailAddress, callbackUrl }));

    expect(verificationUserService.resendVerificationEmail).toHaveBeenCalledWith(emailAddress, callbackUrl);
    expect(result).toMatchObject({
      data: {
        id: emailAddress,
        type: "verifications",
        attributes: { emailAddress }
      }
    });
  });
});
