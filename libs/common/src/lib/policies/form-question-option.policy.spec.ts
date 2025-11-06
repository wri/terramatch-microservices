import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { FormQuestionOptionFactory, UserFactory } from "@terramatch-microservices/database/factories";

describe("FormQuestionOptionPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve(PolicyService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("should allow uploading files for question options if you can forms manage", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions("custom-forms-manage");
    const option = await FormQuestionOptionFactory.create();
    await expectCan(service, ["uploadFiles"], option);
  });

  it("should disallow uploading files for question options if you cannot forms manage", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions("framework-terrafund");
    const option = await FormQuestionOptionFactory.create();
    await expectCannot(service, ["uploadFiles"], option);
  });
});
