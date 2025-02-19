import { PolicyService } from "./policy.service";
import { Test, TestingModule } from "@nestjs/testing";
import { mockPermissions, mockUserId } from "./policy.service.spec";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { UnauthorizedException } from "@nestjs/common";

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

  it("allows reading any polygon with polygons-manage", async () => {
    mockUserId(123);
    mockPermissions("polygons-manage");
    await expect(service.authorize("readAll", SitePolygon)).resolves.toBeUndefined();
  });

  it("disallows reading polygons without polygons-manage", async () => {
    mockUserId(123);
    mockPermissions();
    await expect(service.authorize("readAll", SitePolygon)).rejects.toThrow(UnauthorizedException);
  });
});
