import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { Demographic } from "@terramatch-microservices/database/entities";

describe("DemographicPolicy", () => {
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

  it("allows reading all demographics with framework permissions", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    await expectCan(service, "read", new Demographic());
    await expectCannot(service, "delete", new Demographic());
  });

  it("dany reading all demographics with projects-read permissions", async () => {
    mockUserId(123);
    mockPermissions("projects-read");
    await expectCannot(service, "read", new Demographic());
  });
});
