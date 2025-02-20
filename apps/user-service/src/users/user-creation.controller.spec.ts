import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { faker } from "@faker-js/faker";
import { UserCreationController } from "./user-creation.controller";
import { UserCreationService } from "./user-creation.service";
import { UserNewRequest } from "./dto/user-new-request.dto";
import { UserFactory } from "@terramatch-microservices/database/factories";

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
    userCreationService.createNewUser.mockResolvedValue(user);

    const result = await controller.create(request);
    expect(result).toMatchObject({
      data: { id: user.uuid, type: "users" }
    });
  });
});
