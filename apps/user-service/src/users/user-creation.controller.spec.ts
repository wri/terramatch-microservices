import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { UserCreationController } from "./user-creation.controller";
import { UserCreationService } from "./user-creation.service";
import { UserNewRequest } from "./dto/user-new-request.dto";
import { UserFactory } from "@terramatch-microservices/database/factories";
import { NotFoundException } from "@nestjs/common";

describe("UserCreationController", () => {
  let controller: UserCreationController;
  let userCreationService: DeepMocked<UserCreationService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserCreationController],
      providers: [{ provide: UserCreationService, useValue: (userCreationService = createMock<UserCreationService>()) }]
    }).compile();

    controller = module.get<UserCreationController>(UserCreationController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should create a new user", async () => {
    const user = await UserFactory.create();
    const request = new UserNewRequest();
    request.emailAddress = user.emailAddress;
    request.firstName = user.firstName;
    request.lastName = user.lastName;
    userCreationService.createNewUser.mockResolvedValue(user);

    const result = await controller.create(request);
    expect(result).toMatchObject({
      data: {
        id: user.uuid,
        type: "users",
        attributes: {
          uuid: user.uuid,
          emailAddress: request.emailAddress,
          firstName: user.firstName,
          lastName: user.lastName
        }
      }
    });
  });

  it("should return null when an error occur when trying to create a new user", async () => {
    const request = new UserNewRequest();
    userCreationService.createNewUser.mockRejectedValue(null);

    await expect(controller.create(request)).rejects.toBeNull();
  });

  it("should throw NotFoundException if Role is not found", async () => {
    const request = new UserNewRequest();
    userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Role not found"));

    await expect(controller.create(request)).rejects.toThrow(NotFoundException);
  });

  it("should return a error because body localization is not found", async () => {
    const request = new UserNewRequest();
    userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Localization body not found"));

    await expect(controller.create(request)).rejects.toThrow(NotFoundException);
  });

  it("should return a error because subject localization is not found", async () => {
    const request = new UserNewRequest();
    userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Localization subject not found"));

    await expect(controller.create(request)).rejects.toThrow(NotFoundException);
  });

  it("should return a error because title localization is not found", async () => {
    const request = new UserNewRequest();
    userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Localization title not found"));

    await expect(controller.create(request)).rejects.toThrow(NotFoundException);
  });

  it("should return a error because CTA localization is not found", async () => {
    const request = new UserNewRequest();
    userCreationService.createNewUser.mockRejectedValue(new NotFoundException("Localization CTA not found"));

    await expect(controller.create(request)).rejects.toThrow(NotFoundException);
  });

  it("should return a error because some error happen", async () => {
    const request = new UserNewRequest();
    userCreationService.createNewUser.mockRejectedValue(null);

    await expect(controller.create(request)).rejects.toBeNull();
  });
});
