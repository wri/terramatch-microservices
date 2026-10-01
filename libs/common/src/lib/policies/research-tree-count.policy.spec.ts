import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { ResearchTreeCountFactory, UserFactory } from "@terramatch-microservices/database/factories";
import { ResearchTreeCount } from "@terramatch-microservices/database/entities";
import { mockContextForUser } from "../util/testing";

describe("ResearchTreeCountPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve<PolicyService>(PolicyService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("allows managing tree counts with polygons-manage", async () => {
    const user = await UserFactory.create();
    mockContextForUser(user, "polygons-manage");

    await expectCan(service, ["read", "create"], ResearchTreeCount);
    await expectCan(service, ["read", "update", "delete"], await ResearchTreeCountFactory.build());
  });

  it("disallows managing tree counts without polygons-manage", async () => {
    const user = await UserFactory.create();
    mockContextForUser(user, "projects-read");

    await expectCannot(service, ["read", "create"], ResearchTreeCount);
    await expectCannot(service, ["read", "update", "delete"], await ResearchTreeCountFactory.build());
  });
});
