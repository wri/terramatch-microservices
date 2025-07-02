import { Test, TestingModule } from "@nestjs/testing";
import { BoundingBoxController } from "./bounding-box.controller";
import { BoundingBoxService } from "./bounding-box.service";
import { BoundingBoxDto } from "./dto/bounding-box.dto";
import { BoundingBoxQueryDto } from "./dto/bounding-box-query.dto";
import { JsonApiDocument } from "@terramatch-microservices/common/util";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { PolygonGeometry, Project, Site, SitePolygon } from "@terramatch-microservices/database/entities";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { Op } from "sequelize";

jest.mock("@terramatch-microservices/database/util/subquery.builder", () => ({
  Subquery: {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        literal: "mocked-subquery-literal"
      })
    })
  }
}));

jest.mock("@terramatch-microservices/database/entities", () => ({
  LandscapeGeometry: {
    findAll: jest.fn(),
    LANDSCAPE_SLUGS: [
      "gcb", // Greater Cape Basin
      "grv", // Greater Rift Valley of Kenya
      "ikr" // Lake Kivu & Rusizi River Basin
    ]
  },
  PolygonGeometry: {
    findAll: jest.fn(),
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

  const sampleBoundingBox = new BoundingBoxDto();
  populateDto(sampleBoundingBox, { bbox: [-74.006, 40.7128, -73.9538, 40.8075] });

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
  const mockSite = { id: "site-db-id-123", uuid: "site-123", project: { uuid: "project-123", frameworkKey: "ppc" } };
  const mockProject = { uuid: "project-123", frameworkKey: "ppc", organisationId: 1 };
  const mockSitePolygon = {
    id: "sp-db-id-123",
    uuid: "site-polygon-123",
    polygonUuid: "polygon-123",
    site: mockSite
  };

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

    it("should call getPolygonBoundingBox when polygonUuid is provided and authorize using Site", async () => {
      await testQueryParameters(
        { polygonUuid: "polygon-123" },
        "getPolygonBoundingBox",
        ["polygon-123"],
        "?polygonUuid=polygon-123"
      );

      // Verify Site.findOne is called with the subquery approach
      expect(Site.findOne).toHaveBeenCalledWith({
        where: {
          uuid: {
            [Op.in]: "mocked-subquery-literal"
          }
        },
        attributes: ["frameworkKey", "projectId"]
      });

      expect(mockPolicyService.authorize).toHaveBeenCalledWith("read", mockSite);
    });

    it("should throw NotFoundException when Site with associated polygon is not found", async () => {
      (Site.findOne as jest.Mock).mockResolvedValue(null);

      await expect(controller.getBoundingBox({ polygonUuid: "non-existent" })).rejects.toThrow(
        new NotFoundException("Site with associated polygon UUID non-existent not found")
      );

      expect(Site.findOne).toHaveBeenCalledWith({
        where: {
          uuid: {
            [Op.in]: "mocked-subquery-literal"
          }
        },
        attributes: ["frameworkKey", "projectId"]
      });
    });

    it("should call getSiteBoundingBox when siteUuid is provided", async () => {
      await testQueryParameters({ siteUuid: "site-123" }, "getSiteBoundingBox", ["site-123"], "?siteUuid=site-123");

      expect(Site.findOne).toHaveBeenCalledWith({
        where: { uuid: "site-123" },
        attributes: ["frameworkKey", "projectId"]
      });

      expect(mockPolicyService.authorize).toHaveBeenCalledWith("read", mockSite);
    });

    it("should call getProjectBoundingBox when projectUuid is provided", async () => {
      await testQueryParameters(
        { projectUuid: "project-123" },
        "getProjectBoundingBox",
        ["project-123"],
        "?projectUuid=project-123"
      );

      expect(Project.findOne).toHaveBeenCalledWith({
        where: { uuid: "project-123" },
        attributes: ["id", "uuid", "frameworkKey", "organisationId"]
      });

      expect(mockPolicyService.authorize).toHaveBeenCalledWith("read", mockProject);
    });

    it("should call getCountryLandscapeBoundingBox when country is provided without authorization", async () => {
      await testQueryParameters({ country: "US" }, "getCountryLandscapeBoundingBox", ["US", []], "?country=US", false);
    });

    it("should call getCountryLandscapeBoundingBox when landscapes are provided without authorization", async () => {
      await testQueryParameters(
        { landscapes: ["ikr", "gcb"] },
        "getCountryLandscapeBoundingBox",
        ["", ["ikr", "gcb"]],
        "?landscapes%5B0%5D=gcb&landscapes%5B1%5D=ikr",
        false
      );
    });

    it("should throw NotFoundException when site is not found", async () => {
      (Site.findOne as jest.Mock).mockResolvedValue(null);

      await expect(controller.getBoundingBox({ siteUuid: "non-existent" })).rejects.toThrow(
        new NotFoundException("Site with UUID non-existent not found")
      );
    });

    it("should throw NotFoundException when project is not found", async () => {
      (Project.findOne as jest.Mock).mockResolvedValue(null);

      await expect(controller.getBoundingBox({ projectUuid: "non-existent" })).rejects.toThrow(
        new NotFoundException("Project with UUID non-existent not found")
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
