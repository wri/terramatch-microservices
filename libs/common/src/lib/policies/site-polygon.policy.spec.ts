import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { SitePolygon } from "@terramatch-microservices/database/entities";

describe("SitePolygonPolicy", () => {
  let service: PolicyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PolicyService]
    }).compile();

    service = await module.resolve<PolicyService>(PolicyService);

    mockUserId(123);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it("allows reading any polygon with polygons-manage", async () => {
    mockPermissions("polygons-manage");
    await expectCan(service, "readAll", SitePolygon);
  });

  it("disallows reading polygons without polygons-manage", async () => {
    mockPermissions();
    await expectCannot(service, "readAll", SitePolygon);
  });
});
