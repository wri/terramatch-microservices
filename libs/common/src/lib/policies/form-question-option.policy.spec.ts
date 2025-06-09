import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectAuthority, expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { FormQuestionOption } from "@terramatch-microservices/database/entities";
import { FormFactory, FormQuestionOptionFactory, UserFactory } from "@terramatch-microservices/database/factories";

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

  it("should allow managing question options in your framework", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    const ppcForm = await FormFactory.create({ frameworkKey: "ppc" });
    const tfForm = await FormFactory.create({ frameworkKey: "terrafund" });
    const ppcOption = await FormQuestionOptionFactory.create({ formQuestionId: ppcForm.id });
    const tfOption = await FormQuestionOptionFactory.create({ formQuestionId: tfForm.id });
    await expectAuthority(service, {
      can: [[["read", "update", "delete", "uploadFiles"], ppcOption]],
      cannot: [[["read", "update", "delete", "uploadFiles"], tfOption]]
    });
  });

  it("should allow managing question options with forms-manage permission", async () => {
    mockUserId(123);
    mockPermissions("forms-manage");
    const form = await FormFactory.create();
    const option = await FormQuestionOptionFactory.create({ formQuestionId: form.id });
    await expectCan(service, ["read", "create", "update", "delete", "uploadFiles"], option);
  });

  it("should allow managing question options for forms created/updated by the user", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions();
    const form = await FormFactory.create({ updatedBy: user.id });
    const option = await FormQuestionOptionFactory.create({ formQuestionId: form.id });
    await expectCan(service, ["read", "update", "uploadFiles"], option);
  });

  it("should disallow managing question options without proper permissions", async () => {
    mockUserId(123);
    mockPermissions();
    const form = await FormFactory.create();
    const option = await FormQuestionOptionFactory.create({ formQuestionId: form.id });
    await expectCannot(service, ["read", "update", "delete", "uploadFiles"], option);
  });
});
