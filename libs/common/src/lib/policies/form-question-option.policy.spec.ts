import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import {
  FormFactory,
  FormQuestionFactory,
  FormQuestionOptionFactory,
  UserFactory
} from "@terramatch-microservices/database/factories";

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

  it("should allow uploading files for question options in forms updated by the user", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions();
    await FormFactory.create({ updatedBy: user.id });
    const question = await FormQuestionFactory.create();
    const option = await FormQuestionOptionFactory.create({ formQuestionId: question.id });
    await expectCan(service, ["uploadFiles"], option);
  });

  it("should disallow uploading files for question options in forms not updated by the user", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions();
    await FormFactory.create({ updatedBy: user.id + 1 }); // Different user
    const question = await FormQuestionFactory.create();
    const option = await FormQuestionOptionFactory.create({ formQuestionId: question.id });
    await expectCannot(service, ["uploadFiles"], option);
  });

  it("should disallow managing question options without proper permissions", async () => {
    mockUserId(123);
    mockPermissions();
    await FormFactory.create();
    const question = await FormQuestionFactory.create();
    const option = await FormQuestionOptionFactory.create({ formQuestionId: question.id });
    await expectCannot(service, ["read", "create", "update", "delete"], option);
  });
});
