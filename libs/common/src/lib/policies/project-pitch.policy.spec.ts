import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot } from "./policy.service.spec";
import { ProjectPitch } from "@terramatch-microservices/database/entities";
import { mockPermissions, mockUserId } from "../util/testing";

describe("ProjectPitchPolicy", () => {
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

  it("allows reading all project pitch  with framework permissions", async () => {
    mockUserId(123);
    mockPermissions("framework-ppc");
    await expectCan(service, "read", new ProjectPitch());
    await expectCannot(service, "delete", new ProjectPitch());
  });

  it("dany reading all project pitch with projects-read permissions", async () => {
    mockUserId(123);
    mockPermissions("projects-read");
    await expectCannot(service, "read", new ProjectPitch());
  });
});
