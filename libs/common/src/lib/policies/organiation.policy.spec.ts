import { PolicyService } from "./policy.service";
import { Test } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { Organisation } from "@terramatch-microservices/database/entities";

describe("OrganisationPolicy", () => {
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

  it("allows creating organisations with users-manage permissions", async () => {
    mockUserId(123);
    mockPermissions("users-manage");
    await expectCan(service, "create", Organisation);
  });

  it("disallows creating organisations without users-manage permissions", async () => {
    mockUserId(123);
    mockPermissions();
    await expectCannot(service, "create", Organisation);
  });
});
