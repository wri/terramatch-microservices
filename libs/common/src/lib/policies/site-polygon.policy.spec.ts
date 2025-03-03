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

  it("allows managing any polygon with polygons-manage", async () => {
    mockUserId(123);
    mockPermissions("polygons-manage");
    await expectCan(service, "manage", SitePolygon);
  });

  it("allows managing polygons within frameworks", async () => {
    const site = await SiteFactory.create({ frameworkKey: "ppc" });

    mockUserId(123);
    mockPermissions("polygons-manage", "framework-ppc");
    const sitePolygon = new SitePolygon();
    sitePolygon.siteUuid = site.uuid;

    await expectCan(service, "manage", sitePolygon);
  });

  it("disallows reading polygons without polygons-manage", async () => {
    mockUserId(123);
    mockPermissions();
    await expectCannot(service, "readAll", SitePolygon);
  });
});
