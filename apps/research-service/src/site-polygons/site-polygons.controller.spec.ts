import { SitePolygonsController } from "./site-polygons.controller";
import { SitePolygonQueryBuilder, SitePolygonsService } from "./site-polygons.service";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test, TestingModule } from "@nestjs/testing";
import { PolicyService } from "@terramatch-microservices/common";
import { BadRequestException, NotImplementedException, UnauthorizedException } from "@nestjs/common";

describe("SitePolygonsController", () => {
  let controller: SitePolygonsController;
  let sitePolygonService: DeepMocked<SitePolygonsService>;
  let policyService: DeepMocked<PolicyService>;

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
      const Builder = { execute: jest.fn() };
      Builder.execute.mockResolvedValue([]);
      sitePolygonService.buildQuery.mockResolvedValue(Builder as unknown as SitePolygonQueryBuilder);
      const result = await controller.findMany({});
      expect(result.meta).not.toBe(null);
      expect(result.meta.page.total).toBe(0);
      expect(result.meta.page.cursor).toBeUndefined();
    });
  });

  describe("bulkUpdate", () => {
    it("Should throw", async () => {
      await expect(controller.bulkUpdate(null)).rejects.toThrow(NotImplementedException);
    });
  });
});
