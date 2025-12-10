import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { FormFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { mockPermissions, mockUserId } from "../util/testing";

describe("FormPolicy", () => {
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

  it("should allow uploading files to forms if you can forms manage", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions("custom-forms-manage");
    const form = await FormFactory.create();
    await expectCan(service, ["uploadFiles"], form);
  });

  it("should disallow uploading files for forms if you cannot forms manage", async () => {
    const user = await UserFactory.create();
    mockUserId(user.id);
    mockPermissions("framework-terrafund");
    const form = await FormFactory.create();
    await expectCannot(service, ["uploadFiles"], form);
  });
});
