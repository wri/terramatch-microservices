import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { Disturbance } from "@terramatch-microservices/database/entities";
import { mockPermissions, mockUserId } from "../util/testing";

describe("DisturbancePolicy", () => {
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

  it("allows reading all disturbances with framework permissions", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    await expectCan(service, "read", new Disturbance());
    await expectCannot(service, "delete", new Disturbance());
  });

  it("dany reading all disturbances with projects-read permissions", async () => {
    mockUserId(123);
    mockPermissions("projects-read");
    await expectCannot(service, "read", new Disturbance());
  });
});
