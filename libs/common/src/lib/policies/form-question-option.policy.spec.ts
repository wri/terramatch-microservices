import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, mockPermissions, mockUserId } from "./policy.service.spec";
import {
  FormFactory,
  FormQuestionFactory,
  FormQuestionOptionFactory,
  UserFactory,
  FormSectionFactory
} from "@terramatch-microservices/database/factories";
import { faker } from "@faker-js/faker";

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
    const frameworkKey = "ppc";
    mockPermissions(`framework-${frameworkKey}`);
    const form = await FormFactory.create({ frameworkKey });
    const section = await FormSectionFactory.create({ formId: form.uuid });
    const question = await FormQuestionFactory.create({ formSectionId: section.id });
    const option = await FormQuestionOptionFactory.create({ formQuestionId: question.id });
    await expectCan(service, ["uploadFiles"], option);
  });
});
