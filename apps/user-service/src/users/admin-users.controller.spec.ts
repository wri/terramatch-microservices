import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Response } from "express";
import { UsersController } from "./users.controller";
import { AdminUsersService } from "./admin-users.service";
import { PolicyService } from "@terramatch-microservices/common";
import { User } from "@terramatch-microservices/database/entities";
import { faker } from "@faker-js/faker";
import { mockUserId } from "@terramatch-microservices/common/util/testing";
import { UserCreationService } from "./user-creation.service";

describe("UsersController admin verify action", () => {
  let controller: UsersController;
  let policyService: DeepMocked<PolicyService>;
  let adminUsersService: DeepMocked<AdminUsersService>;

  const mockRes = (): DeepMocked<Response> => {
    const res = createMock<Response>();
    res.status.mockReturnThis();
    res.json.mockReturnThis();
    return res;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UserCreationService, useValue: createMock<UserCreationService>() },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) },
        { provide: AdminUsersService, useValue: (adminUsersService = createMock<AdminUsersService>()) }
      ]
    }).compile();

    controller = module.get<UsersController>(UsersController);
    mockUserId(1);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("adminVerify", () => {
    const uuid = faker.string.uuid();

    it("returns 200 and User verified. when authorized and user exists", async () => {
      const user = createMock<User>({ id: 1, uuid });
      jest.spyOn(User, "findOne").mockResolvedValue(user as unknown as User);
      policyService.authorize.mockResolvedValue(undefined);
      adminUsersService.verifyByUuid.mockResolvedValue(undefined);

      const res = mockRes();
      await controller.adminVerify(uuid, res);

      expect(policyService.authorize).toHaveBeenCalledWith("verify", user);
      expect(adminUsersService.verifyByUuid).toHaveBeenCalledWith(uuid);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith("User verified.");
    });

    it("throws NotFoundException when user does not exist", async () => {
      jest.spyOn(User, "findOne").mockResolvedValue(null);

      const res = mockRes();
      await expect(controller.adminVerify(uuid, res)).rejects.toThrow(NotFoundException);
    });

    it("throws UnauthorizedException when policy denies", async () => {
      const user = createMock<User>({ id: 999, uuid });
      jest.spyOn(User, "findOne").mockResolvedValue(user as unknown as User);
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      const res = mockRes();
      await expect(controller.adminVerify(uuid, res)).rejects.toThrow(UnauthorizedException);
    });
  });
});
