import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BoundingBoxController } from "./bounding-box.controller";
import { BoundingBoxService } from "../services/bounding-box.service";
import { BoundingBoxQueryDto } from "../dto/bounding-box-query.dto";
import { BoundingBoxDto } from "../dto/bounding-box.dto";
import { NotFoundException } from "@nestjs/common";
import { Resource } from "@terramatch-microservices/common/util";

describe("BoundingBoxController", () => {
  let controller: BoundingBoxController;
  let boundingBoxService: DeepMocked<BoundingBoxService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [BoundingBoxController],
      providers: [{ provide: BoundingBoxService, useValue: (boundingBoxService = createMock<BoundingBoxService>()) }]
    }).compile();

    controller = module.get(BoundingBoxController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const mockBoundingBoxDto = new BoundingBoxDto({
    bbox: [-10, -10, 10, 10] // [minLng, minLat, maxLng, maxLat]
  });

  describe("getBoundingBox", () => {
    it("should throw error when no parameters are provided", async () => {
      const query = new BoundingBoxQueryDto();
      await expect(controller.getBoundingBox(query)).rejects.toThrow("No valid filter parameters provided");
    });

    it("should get bounding box for a polygon", async () => {
      const query = new BoundingBoxQueryDto();
      query.polygonUuid = "test-polygon-uuid";

      boundingBoxService.getPolygonBoundingBox.mockResolvedValue(mockBoundingBoxDto);

      const result = await controller.getBoundingBox(query);
      expect(boundingBoxService.getPolygonBoundingBox).toHaveBeenCalledWith(query.polygonUuid);

      // Verify the response structure
      expect(result).toBeInstanceOf(Object);
      expect(result.data).toBeDefined();

      const resource = result.data as Resource;
      expect(resource.id).toBe(query.polygonUuid);
      expect(resource.type).toBe("boundingBoxes");
      expect(resource.attributes.bbox).toEqual([-10, -10, 10, 10]);
    });

    it("should get bounding box for a site", async () => {
      const query = new BoundingBoxQueryDto();
      query.siteUuid = "test-site-uuid";

      boundingBoxService.getSiteBoundingBox.mockResolvedValue(mockBoundingBoxDto);

      const result = await controller.getBoundingBox(query);
      expect(boundingBoxService.getSiteBoundingBox).toHaveBeenCalledWith(query.siteUuid);

      const resource = result.data as Resource;
      expect(resource.id).toBe(query.siteUuid);
      expect(resource.attributes.bbox).toEqual([-10, -10, 10, 10]);
    });

    it("should get bounding box for a project", async () => {
      const query = new BoundingBoxQueryDto();
      query.projectUuid = "test-project-uuid";

      boundingBoxService.getProjectBoundingBox.mockResolvedValue(mockBoundingBoxDto);

      const result = await controller.getBoundingBox(query);
      expect(boundingBoxService.getProjectBoundingBox).toHaveBeenCalledWith(query.projectUuid);

      const resource = result.data as Resource;
      expect(resource.id).toBe(query.projectUuid);
      expect(resource.attributes.bbox).toEqual([-10, -10, 10, 10]);
    });

    it("should get bounding box for a country with landscapes", async () => {
      const query = new BoundingBoxQueryDto();
      query.country = "KEN";
      query.landscapes = ["test-landscape-1", "test-landscape-2"];

      boundingBoxService.getCountryLandscapeBoundingBox.mockResolvedValue(mockBoundingBoxDto);

      const result = await controller.getBoundingBox(query);
      expect(boundingBoxService.getCountryLandscapeBoundingBox).toHaveBeenCalledWith(query.country, query.landscapes);

      const resource = result.data as Resource;
      expect(resource.id).toBe("KEN-test-landscape-1-test-landscape-2");
      expect(resource.attributes.bbox).toEqual([-10, -10, 10, 10]);
    });

    it("should get bounding box for a country only", async () => {
      const query = new BoundingBoxQueryDto();
      query.country = "KEN";

      boundingBoxService.getCountryLandscapeBoundingBox.mockResolvedValue(mockBoundingBoxDto);

      const result = await controller.getBoundingBox(query);
      expect(boundingBoxService.getCountryLandscapeBoundingBox).toHaveBeenCalledWith(query.country, []);

      const resource = result.data as Resource;
      expect(resource.id).toBe("KEN-");
      expect(resource.attributes.bbox).toEqual([-10, -10, 10, 10]);
    });

    it("should get bounding box for landscapes only", async () => {
      const query = new BoundingBoxQueryDto();
      query.landscapes = ["test-landscape-1", "test-landscape-2"];

      boundingBoxService.getCountryLandscapeBoundingBox.mockResolvedValue(mockBoundingBoxDto);

      const result = await controller.getBoundingBox(query);
      expect(boundingBoxService.getCountryLandscapeBoundingBox).toHaveBeenCalledWith("global", query.landscapes);

      const resource = result.data as Resource;
      expect(resource.id).toBe("global-test-landscape-1-test-landscape-2");
      expect(resource.attributes.bbox).toEqual([-10, -10, 10, 10]);
    });

    it("should handle service errors and throw appropriate exceptions", async () => {
      const query = new BoundingBoxQueryDto();
      query.polygonUuid = "test-polygon-uuid";

      boundingBoxService.getPolygonBoundingBox.mockRejectedValue(new NotFoundException("Polygon not found"));

      await expect(controller.getBoundingBox(query)).rejects.toThrow(NotFoundException);
    });
  });
});
