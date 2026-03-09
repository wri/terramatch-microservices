import { Test, TestingModule } from "@nestjs/testing";
import { createMock } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { AdminUsersService } from "./admin-users.service";
import { User } from "@terramatch-microservices/database/entities";
import { faker } from "@faker-js/faker";
import * as bcrypt from "bcryptjs";

jest.mock("bcryptjs", () => ({ hash: jest.fn().mockResolvedValue("hashed") }));

describe("AdminUsersService", () => {
  let service: AdminUsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminUsersService]
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("resetPasswordByUuid", () => {
    it("throws NotFoundException when user does not exist", async () => {
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      await expect(service.resetPasswordByUuid(faker.string.uuid(), "ValidPass1")).rejects.toThrow(NotFoundException);
    });

    it("updates user password with hashed value", async () => {
      const uuid = faker.string.uuid();
      const user = createMock<User>({ id: 1, uuid, update: jest.fn().mockResolvedValue(undefined) });
      jest.spyOn(User, "findOne").mockResolvedValue(user as unknown as User);

      await service.resetPasswordByUuid(uuid, "NewSecureP4ss");

      expect(bcrypt.hash).toHaveBeenCalledWith("NewSecureP4ss", 10);
      expect(user.update).toHaveBeenCalledWith({ password: "hashed" });
    });
  });

  describe("verifyByUuid", () => {
    it("throws NotFoundException when user does not exist", async () => {
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      await expect(service.verifyByUuid(faker.string.uuid())).rejects.toThrow(NotFoundException);
    });

    it("sets emailAddressVerifiedAt on user", async () => {
      const uuid = faker.string.uuid();
      const user = createMock<User>({ id: 1, uuid, update: jest.fn().mockResolvedValue(undefined) });
      jest.spyOn(User, "findOne").mockResolvedValue(user as unknown as User);

      await service.verifyByUuid(uuid);

      expect(user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          emailAddressVerifiedAt: expect.any(Date)
        })
      );
    });
  });
});
