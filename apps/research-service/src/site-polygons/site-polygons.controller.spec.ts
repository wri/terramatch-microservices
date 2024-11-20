import { SitePolygonsController } from "./site-polygons.controller";
import { SitePolygonsService } from "./site-polygons.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { BadRequestException, NotImplementedException, UnauthorizedException } from "@nestjs/common";
import { Resource } from "@terramatch-microservices/common/util";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { SitePolygonFactory } from "@terramatch-microservices/database/factories";

describe("SitePolygonsController", () => {
  let controller: SitePolygonsController;
  let sitePolygonService: DeepMocked<SitePolygonsService>;
  let policyService: DeepMocked<PolicyService>;

  const mockQueryBuilder = (executeResult: SitePolygon[] = []) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {
      execute: jest.fn(),
      hasStatuses: jest.fn().mockReturnThis(),
      modifiedSince: jest.fn().mockReturnThis(),
      isMissingIndicators: jest.fn().mockReturnThis()
    };
    builder.touchesBoundary = jest.fn().mockResolvedValue(builder);
    builder.filterProjectUuids = jest.fn().mockResolvedValue(builder);
    builder.excludeTestProjects = jest.fn().mockResolvedValue(builder);

    builder.execute.mockResolvedValue(executeResult);
    sitePolygonService.buildQuery.mockResolvedValue(builder);

    return builder;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SitePolygonsController],
      providers: [
        { provide: SitePolygonsService, useValue: (sitePolygonService = createMock<SitePolygonsService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get<SitePolygonsController>(SitePolygonsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("findMany", () => {
    it("should should throw an error if the policy does not authorize", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());
      await expect(controller.findMany({})).rejects.toThrow(UnauthorizedException);
    });

    it("should throw an error if the page size is invalid", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      await expect(controller.findMany({ page: { size: 300 } })).rejects.toThrow(BadRequestException);
      await expect(controller.findMany({ page: { size: -1 } })).rejects.toThrow(BadRequestException);
    });

    it("should throw an error if the page after is invalid", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      sitePolygonService.buildQuery.mockRejectedValue(new BadRequestException());
      await expect(controller.findMany({ page: { after: "asdfasdf" } })).rejects.toThrow(BadRequestException);
    });

    it("Returns a valid value if the request is valid", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const sitePolygon = await SitePolygonFactory.build();
      mockQueryBuilder([sitePolygon]);
      const result = await controller.findMany({});
      expect(result.meta).not.toBe(null);
      expect(result.meta.page.total).toBe(1);
      expect(result.meta.page.cursor).toBe(sitePolygon.uuid);

      const resources = result.data as Resource[];
      expect(resources.length).toBe(1);
      expect(resources[0].id).toBe(sitePolygon.uuid);
    });

    it("Excludes test projects by default", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();
      const result = await controller.findMany({});
      expect(result.meta.page.total).toBe(0);

      expect(builder.excludeTestProjects).toHaveBeenCalled();
    });

    it("will either honor projectIds or includeTestProjects", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      const builder = mockQueryBuilder();

      await controller.findMany({ projectId: ["asdf"] });
      expect(builder.filterProjectUuids).toHaveBeenCalledWith(["asdf"]);
      expect(builder.excludeTestProjects).not.toHaveBeenCalled();
      builder.filterProjectUuids.mockClear();

      await controller.findMany({ includeTestProjects: true });
      expect(builder.filterProjectUuids).not.toHaveBeenCalled();
      expect(builder.excludeTestProjects).not.toHaveBeenCalled();

      await controller.findMany({});
      expect(builder.filterProjectUuids).not.toHaveBeenCalled();
      expect(builder.excludeTestProjects).toHaveBeenCalled();
    });
  });

  describe("bulkUpdate", () => {
    it("Should throw", async () => {
      await expect(controller.bulkUpdate(null)).rejects.toThrow(NotImplementedException);
    });
  });
});
