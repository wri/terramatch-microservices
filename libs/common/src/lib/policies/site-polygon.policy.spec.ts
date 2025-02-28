import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { expectCan, expectCannot, mockPermissions, mockUserId } from "./policy.service.spec";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { SiteFactory } from "@terramatch-microservices/database/factories";

describe("SitePolygonPolicy", () => {
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

  it("allows reading any polygon with polygons-manage and frameworks", async () => {
    const site = await SiteFactory.create({ frameworkKey: "ppc" });

    mockUserId(123);
    mockPermissions("polygons-manage", "framework-ppc");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "readAll", SitePolygon);
    await expectCan(service, "manage", sitePolygon);
  });

  it("disallows reading polygons without polygons-manage", async () => {
    mockUserId(123);
    mockPermissions();
    await expectCannot(service, "readAll", SitePolygon);
  });

  it("disallows managing polygons with polygons-manage but no frameworks", async () => {
    mockUserId(123);
    mockPermissions("polygons-manage");
    const sitePolygon = new SitePolygon();
    await expectCannot(service, "manage", sitePolygon);
  });
});
