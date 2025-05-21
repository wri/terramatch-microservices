import { Test, TestingModule } from "@nestjs/testing";
import { BoundingBoxController } from "./bounding-box.controller";
import { BoundingBoxService } from "./bounding-box.service";
import { BoundingBoxDto } from "./dto/bounding-box.dto";
import { BoundingBoxQueryDto } from "./dto/bounding-box-query.dto";
import { JsonApiDocument } from "@terramatch-microservices/common/util";
import { BadRequestException } from "@nestjs/common";

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BoundingBoxController],
      providers: [
        {
          provide: BoundingBoxService,
          useValue: mockBoundingBoxService
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
      expectedId: string
    ) => {
      const result = (await controller.getBoundingBox(queryParams)) as JsonApiDocument;

      expect(mockBoundingBoxService[expectedService]).toHaveBeenCalledWith(...expectedArgs);
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

    it("should call getPolygonBoundingBox when polygonUuid is provided", async () => {
      await testQueryParameters(
        { polygonUuid: "polygon-123" },
        "getPolygonBoundingBox",
        ["polygon-123"],
        "polygon-123"
      );
    });

    it("should call getSiteBoundingBox when siteUuid is provided", async () => {
      await testQueryParameters({ siteUuid: "site-123" }, "getSiteBoundingBox", ["site-123"], "site-123");
    });

    it("should call getProjectBoundingBox when projectUuid is provided", async () => {
      await testQueryParameters(
        { projectUuid: "project-123" },
        "getProjectBoundingBox",
        ["project-123"],
        "project-123"
      );
    });

    it("should call getCountryLandscapeBoundingBox when country is provided", async () => {
      await testQueryParameters({ country: "US" }, "getCountryLandscapeBoundingBox", ["US", []], "US-");
    });

    it("should call getCountryLandscapeBoundingBox when landscapes are provided", async () => {
      await testQueryParameters(
        { landscapes: ["ikr", "amazon"] },
        "getCountryLandscapeBoundingBox",
        ["global", ["ikr", "amazon"]],
        "global-ikr-amazon"
      );
    });

    it("should call getCountryLandscapeBoundingBox when both country and landscapes are provided", async () => {
      await testQueryParameters(
        { country: "RW", landscapes: ["ikr"] },
        "getCountryLandscapeBoundingBox",
        ["RW", ["ikr"]],
        "RW-ikr"
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
