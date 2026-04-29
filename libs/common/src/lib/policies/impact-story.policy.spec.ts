import { Test } from "@nestjs/testing";
import { PolicyService } from "./policy.service";
import { ImpactStoryFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { expectCan } from "./policy.service.spec";
import { mockRequestContext } from "../util/testing";

describe("ImpactStoryPolicy", () => {
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

  it("should allow uploading files for impact stories for admins", async () => {
    const user = await UserFactory.create();
    mockRequestContext({ userId: user.id, permissions: ["framework-ppc"] });
    const impactStory = await ImpactStoryFactory.create();
    await expectCan(service, ["uploadFiles"], impactStory);
  });
});
