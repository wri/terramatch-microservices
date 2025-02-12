import { Test, TestingModule } from "@nestjs/testing";
import { User, Verification } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { VerificationUserService } from "./verification-user.service";
import { UserFactory } from "@terramatch-microservices/database/factories";
import { VerificationFactory } from "@terramatch-microservices/database/factories/verification.factory";

describe("VerificationUserService", () => {
  let service: VerificationUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VerificationUserService]
    }).compile();

    service = module.get<VerificationUserService>(VerificationUserService);
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
    jest.spyOn(User, "findOne").mockImplementation(() => Promise.resolve(user));
    const verification = await VerificationFactory.create({ userId: user.id });
    jest.spyOn(Verification, "findOne").mockImplementation(() => Promise.resolve(verification));
    const destroySpy = jest.spyOn(verification, "destroy").mockResolvedValue();

    const result = await service.verify(verification.token);
    expect(user.emailAddressVerifiedAt).toBeDefined();
    expect(destroySpy).toHaveBeenCalled();
    expect(result).toStrictEqual({ uuid: user.uuid, isVerified: true });
  });
});
