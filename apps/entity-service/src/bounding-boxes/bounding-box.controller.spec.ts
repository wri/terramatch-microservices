import { Test, TestingModule } from "@nestjs/testing";
import { BoundingBoxController } from "./bounding-box.controller";
import { BoundingBoxService } from "./bounding-box.service";
import { BoundingBoxDto } from "./dto/bounding-box.dto";
import { BoundingBoxQueryDto } from "./dto/bounding-box-query.dto";
import { JsonApiDocument } from "@terramatch-microservices/common/util";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { PolygonGeometry, Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";

jest.mock("@terramatch-microservices/database/entities", () => ({
  PolygonGeometry: {
    findOne: jest.fn()
  },
  Site: {
    findOne: jest.fn()
  },
  Project: {
    findOne: jest.fn()
  },
  SitePolygon: {
    findOne: jest.fn()
  }
}));

describe("BoundingBoxController", () => {
  let controller: BoundingBoxController;

  const sampleBoundingBox = new BoundingBoxDto({
    bbox: [-74.006, 40.7128, -73.9538, 40.8075]
  });

  const mockBoundingBoxService = {
    getPolygonBoundingBox: jest.fn().mockResolvedValue(sampleBoundingBox),
    getSiteBoundingBox: jest.fn().mockResolvedValue(sampleBoundingBox),
    getProjectBoundingBox: jest.fn().mockResolvedValue(sampleBoundingBox),
    getCountryLandscapeBoundingBox: jest.fn().mockResolvedValue(sampleBoundingBox)
  };

  const mockPolicyService = {
    authorize: jest.fn().mockResolvedValue(undefined)
  };

  const mockPolygon = { uuid: "polygon-123" };
  const mockSite = { uuid: "site-123", project: { uuid: "project-123", frameworkKey: "ppc" } };
  const mockProject = { uuid: "project-123", frameworkKey: "ppc", organisationId: 1 };
  const mockSitePolygon = { uuid: "site-polygon-123", siteUuid: "site-123", polygonUuid: "polygon-123" };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Setup mock responses
    (PolygonGeometry.findOne as jest.Mock).mockResolvedValue(mockPolygon);
    (Site.findOne as jest.Mock).mockResolvedValue(mockSite);
    (Project.findOne as jest.Mock).mockResolvedValue(mockProject);
    (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoundingBoxController],
      providers: [
        {
          provide: BoundingBoxService,
          useValue: mockBoundingBoxService
        },
        {
          provide: PolicyService,
          useValue: mockPolicyService
        }
      ]
    }).compile();

    controller = module.get<BoundingBoxController>(BoundingBoxController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getBoundingBox", () => {
    type BoundingBoxServiceArgs = [string] | [string, string[]];

    const testQueryParameters = async (
      queryParams: BoundingBoxQueryDto,
      expectedService: keyof typeof mockBoundingBoxService,
      expectedArgs: BoundingBoxServiceArgs,
      expectedId: string,
      shouldAuthorize = true
    ) => {
      const result = (await controller.getBoundingBox(queryParams)) as JsonApiDocument;

      expect(mockBoundingBoxService[expectedService]).toHaveBeenCalledWith(...expectedArgs);

      if (shouldAuthorize) {
        expect(mockPolicyService.authorize).toHaveBeenCalledWith("read", expect.anything());
      } else {
        expect(mockPolicyService.authorize).not.toHaveBeenCalled();
      }

      expect(result.data).toBeDefined();

      // Handle both single resource and resource array cases
      if (Array.isArray(result.data)) {
        expect(result.data[0].id).toBe(expectedId);
        expect(result.data[0].attributes).toEqual(sampleBoundingBox);
      } else {
        expect(result.data?.id).toBe(expectedId);
        expect(result.data?.attributes).toEqual(sampleBoundingBox);
      }
    };

    it("should call getPolygonBoundingBox when polygonUuid is provided and authorize using SitePolygon", async () => {
      await testQueryParameters(
        { polygonUuid: "polygon-123" },
        "getPolygonBoundingBox",
        ["polygon-123"],
        "polygon-123"
      );

      expect(SitePolygon.findOne).toHaveBeenCalledWith({
        where: { polygonUuid: "polygon-123" },
        attributes: ["uuid", "siteUuid", "polygonUuid"]
      });

      expect(mockPolicyService.authorize).toHaveBeenCalledWith("read", mockSitePolygon);
      expect(PolygonGeometry.findOne).not.toHaveBeenCalled();
    });

    it("should fall back to direct polygon lookup if no SitePolygon is found", async () => {
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(null);

      await testQueryParameters(
        { polygonUuid: "polygon-123" },
        "getPolygonBoundingBox",
        ["polygon-123"],
        "polygon-123"
      );

      expect(SitePolygon.findOne).toHaveBeenCalled();
      expect(PolygonGeometry.findOne).toHaveBeenCalledWith({
        where: { uuid: "polygon-123" },
        attributes: ["uuid"]
      });

      expect(mockPolicyService.authorize).toHaveBeenCalledWith("read", mockPolygon);
    });

    it("should call getSiteBoundingBox when siteUuid is provided", async () => {
      await testQueryParameters({ siteUuid: "site-123" }, "getSiteBoundingBox", ["site-123"], "site-123");

      expect(Site.findOne).toHaveBeenCalledWith({
        where: { uuid: "site-123" },
        include: [
          {
            association: "project",
            attributes: ["id", "uuid", "frameworkKey"]
          }
        ]
      });

      expect(mockPolicyService.authorize).toHaveBeenCalledWith("read", mockSite);
    });

    it("should call getProjectBoundingBox when projectUuid is provided", async () => {
      await testQueryParameters(
        { projectUuid: "project-123" },
        "getProjectBoundingBox",
        ["project-123"],
        "project-123"
      );

      expect(Project.findOne).toHaveBeenCalledWith({
        where: { uuid: "project-123" },
        attributes: ["uuid", "frameworkKey", "organisationId"]
      });

      expect(mockPolicyService.authorize).toHaveBeenCalledWith("read", mockProject);
    });

    it("should call getCountryLandscapeBoundingBox when country is provided without authorization", async () => {
      await testQueryParameters({ country: "US" }, "getCountryLandscapeBoundingBox", ["US", []], "US-", false);
    });

    it("should call getCountryLandscapeBoundingBox when landscapes are provided without authorization", async () => {
      await testQueryParameters(
        { landscapes: ["ikr", "amazon"] },
        "getCountryLandscapeBoundingBox",
        ["global", ["ikr", "amazon"]],
        "global-ikr-amazon",
        false
      );
    });

    it("should throw NotFoundException when polygon is not found", async () => {
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(null);
      (PolygonGeometry.findOne as jest.Mock).mockResolvedValue(null);

      await expect(controller.getBoundingBox({ polygonUuid: "non-existent" })).rejects.toThrow(
        new NotFoundException("Polygon with UUID non-existent not found")
      );
    });

    it("should throw BadRequestException when no valid filter parameters are provided", async () => {
      const query: BoundingBoxQueryDto = {};

      await expect(controller.getBoundingBox(query)).rejects.toThrow(
        new BadRequestException(
          "No valid filter parameters provided. Please specify one of: polygonUuid, siteUuid, projectUuid, country, or landscapes."
        )
      );
    });

    it("should throw BadRequestException when multiple entity types are provided simultaneously", async () => {
      const invalidCombinations = [
        { polygonUuid: "polygon-123", siteUuid: "site-123" },
        { polygonUuid: "polygon-123", projectUuid: "project-123" },
        { siteUuid: "site-123", projectUuid: "project-123" },
        { polygonUuid: "polygon-123", country: "US" },
        { siteUuid: "site-123", landscapes: ["ikr"] },
        { projectUuid: "project-123", country: "US", landscapes: ["ikr"] }
      ];

      for (const query of invalidCombinations) {
        await expect(controller.getBoundingBox(query)).rejects.toThrow(BadRequestException);
        await expect(controller.getBoundingBox(query)).rejects.toThrow(/Mutually exclusive parameters provided/);
      }
    });
  });
});
