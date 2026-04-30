import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { Tracking } from "@terramatch-microservices/database/entities";
import { mockRequestContext } from "../util/testing";

describe("TrackingPolicy", () => {
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

  it("allows reading all trackings with framework permissions", async () => {
    mockRequestContext({ userId: 123, permissions: ["framework-ppc"] });
    await expectCan(service, "read", new Tracking());
    await expectCannot(service, "delete", new Tracking());
  });

  it("dany reading all trackings with projects-read permissions", async () => {
    mockRequestContext({ userId: 123, permissions: ["projects-read"] });
    await expectCannot(service, "read", new Tracking());
  });
});
