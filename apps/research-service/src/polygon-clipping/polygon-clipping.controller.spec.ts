import { Test, TestingModule } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { BadRequestException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PolygonClippingController } from "./polygon-clipping.controller";
import { PolygonClippingService } from "./polygon-clipping.service";
import { PolicyService } from "@terramatch-microservices/common";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import {
  SitePolygonClippingRequestBody,
  ProjectPolygonClippingRequestBody,
  PolygonListClippingRequestBody
} from "./dto/clip-polygon-request.dto";
import { FeatureCollection, Polygon, MultiPolygon } from "geojson";

describe("PolygonClippingController", () => {
  let controller: PolygonClippingController;
  let clippingService: DeepMocked<PolygonClippingService>;
  let policyService: DeepMocked<PolicyService>;

  const samplePolygon: Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [104.14293058113105, 13.749724096039358],
        [104.68941630988292, 13.586722290863463],
        [104.40664352872176, 13.993692766531538],
        [104.14293058113105, 13.749724096039358]
      ]
    ]
  };

  const sampleMultiPolygon: MultiPolygon = {
    type: "MultiPolygon",
    coordinates: [
      [
        [
          [104.14293058113105, 13.749724096039358],
          [104.68941630988292, 13.586722290863463],
          [104.40664352872176, 13.993692766531538],
          [104.14293058113105, 13.749724096039358]
        ]
      ]
    ]
  };

  const sampleFeatureCollection: FeatureCollection<Polygon | MultiPolygon> = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          poly_id: "polygon-uuid-1",
          poly_name: "Test Polygon 1"
        },
        geometry: samplePolygon
      }
    ]
  };

  const sampleClippedFeatureCollection: FeatureCollection<Polygon | MultiPolygon> = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {
          poly_id: "polygon-uuid-1",
          poly_name: "Test Polygon 1",
          original_area_ha: 10.5,
          new_area_ha: 10.2,
          area_removed_ha: 0.3
        },
        geometry: sampleMultiPolygon
      }
    ]
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PolygonClippingController],
      providers: [
        { provide: PolygonClippingService, useValue: (clippingService = createMock<PolygonClippingService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get<PolygonClippingController>(PolygonClippingController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createSitePolygonClipping", () => {
    const siteUuid = "550e8400-e29b-41d4-a716-446655440000";
    const payload: SitePolygonClippingRequestBody = {
      data: {
        type: "polygon-clipping",
        attributes: {
          siteUuid
        }
      }
    };

    it("should throw UnauthorizedException when user is not authorized", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.createSitePolygonClipping(payload)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("readAll", SitePolygon);
      expect(clippingService.getFixablePolygonsForSite).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when no fixable polygons are found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue([]);

      await expect(controller.createSitePolygonClipping(payload)).rejects.toThrow(NotFoundException);
      expect(clippingService.getFixablePolygonsForSite).toHaveBeenCalledWith(siteUuid);
    });

    it("should successfully create site polygon clipping", async () => {
      const polygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const clippedResults = [
        {
          polyUuid: "polygon-uuid-1",
          polyName: "Test Polygon 1",
          geometry: sampleMultiPolygon,
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        }
      ];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue(polygonUuids);
      clippingService.getOriginalGeometriesGeoJson.mockResolvedValue(sampleFeatureCollection);
      clippingService.clipPolygons.mockResolvedValue(clippedResults);
      clippingService.buildGeoJsonResponse.mockReturnValue(sampleClippedFeatureCollection);

      const result = await controller.createSitePolygonClipping(payload);

      expect(policyService.authorize).toHaveBeenCalledWith("readAll", SitePolygon);
      expect(clippingService.getFixablePolygonsForSite).toHaveBeenCalledWith(siteUuid);
      expect(clippingService.getOriginalGeometriesGeoJson).toHaveBeenCalledWith(polygonUuids);
      expect(clippingService.clipPolygons).toHaveBeenCalledWith(polygonUuids);
      expect(clippingService.buildGeoJsonResponse).toHaveBeenCalledWith(clippedResults);

      expect(result).toEqual({
        originalGeometries: sampleFeatureCollection,
        clippedGeometries: sampleClippedFeatureCollection,
        summary: {
          totalPolygonsProcessed: 2,
          polygonsClipped: 1,
          message: "Successfully processed 2 polygons, clipped 1 polygons"
        }
      });
    });

    it("should handle multiple polygons being clipped", async () => {
      const polygonUuids = ["polygon-uuid-1", "polygon-uuid-2", "polygon-uuid-3"];
      const clippedResults = [
        {
          polyUuid: "polygon-uuid-1",
          polyName: "Test Polygon 1",
          geometry: sampleMultiPolygon,
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        },
        {
          polyUuid: "polygon-uuid-2",
          polyName: "Test Polygon 2",
          geometry: samplePolygon,
          originalArea: 5.2,
          newArea: 5.0,
          areaRemoved: 0.2
        }
      ];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForSite.mockResolvedValue(polygonUuids);
      clippingService.getOriginalGeometriesGeoJson.mockResolvedValue(sampleFeatureCollection);
      clippingService.clipPolygons.mockResolvedValue(clippedResults);
      clippingService.buildGeoJsonResponse.mockReturnValue(sampleClippedFeatureCollection);

      const result = await controller.createSitePolygonClipping(payload);

      expect(result.summary.totalPolygonsProcessed).toBe(3);
      expect(result.summary.polygonsClipped).toBe(2);
    });
  });

  describe("createProjectPolygonClipping", () => {
    const siteUuid = "550e8400-e29b-41d4-a716-446655440000";
    const payload: ProjectPolygonClippingRequestBody = {
      data: {
        type: "polygon-clipping",
        attributes: {
          siteUuid
        }
      }
    };

    it("should throw UnauthorizedException when user is not authorized", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.createProjectPolygonClipping(payload)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("readAll", SitePolygon);
      expect(clippingService.getFixablePolygonsForProjectBySite).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when no fixable polygons are found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForProjectBySite.mockResolvedValue([]);

      await expect(controller.createProjectPolygonClipping(payload)).rejects.toThrow(NotFoundException);
      expect(clippingService.getFixablePolygonsForProjectBySite).toHaveBeenCalledWith(siteUuid);
    });

    it("should successfully create project polygon clipping", async () => {
      const polygonUuids = ["polygon-uuid-1", "polygon-uuid-2"];
      const clippedResults = [
        {
          polyUuid: "polygon-uuid-1",
          polyName: "Test Polygon 1",
          geometry: sampleMultiPolygon,
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        }
      ];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.getFixablePolygonsForProjectBySite.mockResolvedValue(polygonUuids);
      clippingService.getOriginalGeometriesGeoJson.mockResolvedValue(sampleFeatureCollection);
      clippingService.clipPolygons.mockResolvedValue(clippedResults);
      clippingService.buildGeoJsonResponse.mockReturnValue(sampleClippedFeatureCollection);

      const result = await controller.createProjectPolygonClipping(payload);

      expect(policyService.authorize).toHaveBeenCalledWith("readAll", SitePolygon);
      expect(clippingService.getFixablePolygonsForProjectBySite).toHaveBeenCalledWith(siteUuid);
      expect(clippingService.getOriginalGeometriesGeoJson).toHaveBeenCalledWith(polygonUuids);
      expect(clippingService.clipPolygons).toHaveBeenCalledWith(polygonUuids);
      expect(clippingService.buildGeoJsonResponse).toHaveBeenCalledWith(clippedResults);

      expect(result).toEqual({
        originalGeometries: sampleFeatureCollection,
        clippedGeometries: sampleClippedFeatureCollection,
        summary: {
          totalPolygonsProcessed: 2,
          polygonsClipped: 1,
          message: "Successfully processed 2 polygons, clipped 1 polygons"
        }
      });
    });
  });

  describe("createPolygonListClipping", () => {
    const polygonUuids = ["550e8400-e29b-41d4-a716-446655440000", "660e8400-e29b-41d4-a716-446655440001"];
    const payload: PolygonListClippingRequestBody = {
      data: {
        type: "polygon-clipping",
        attributes: {
          polygonUuids
        }
      }
    };

    it("should throw UnauthorizedException when user is not authorized", async () => {
      policyService.authorize.mockRejectedValue(new UnauthorizedException());

      await expect(controller.createPolygonListClipping(payload)).rejects.toThrow(UnauthorizedException);
      expect(policyService.authorize).toHaveBeenCalledWith("readAll", SitePolygon);
      expect(clippingService.filterFixablePolygonsFromList).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException when no polygon UUIDs are provided", async () => {
      const emptyPayload: PolygonListClippingRequestBody = {
        data: {
          type: "polygon-clipping",
          attributes: {
            polygonUuids: []
          }
        }
      };

      policyService.authorize.mockResolvedValue(undefined);

      await expect(controller.createPolygonListClipping(emptyPayload)).rejects.toThrow(BadRequestException);
      expect(clippingService.filterFixablePolygonsFromList).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when no fixable polygons are found", async () => {
      policyService.authorize.mockResolvedValue(undefined);
      clippingService.filterFixablePolygonsFromList.mockResolvedValue([]);

      await expect(controller.createPolygonListClipping(payload)).rejects.toThrow(NotFoundException);
      expect(clippingService.filterFixablePolygonsFromList).toHaveBeenCalledWith(polygonUuids);
    });

    it("should successfully create polygon list clipping", async () => {
      const fixablePolygonUuids = ["polygon-uuid-1"];
      const clippedResults = [
        {
          polyUuid: "polygon-uuid-1",
          polyName: "Test Polygon 1",
          geometry: sampleMultiPolygon,
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        }
      ];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.filterFixablePolygonsFromList.mockResolvedValue(fixablePolygonUuids);
      clippingService.getOriginalGeometriesGeoJson.mockResolvedValue(sampleFeatureCollection);
      clippingService.clipPolygons.mockResolvedValue(clippedResults);
      clippingService.buildGeoJsonResponse.mockReturnValue(sampleClippedFeatureCollection);

      const result = await controller.createPolygonListClipping(payload);

      expect(policyService.authorize).toHaveBeenCalledWith("readAll", SitePolygon);
      expect(clippingService.filterFixablePolygonsFromList).toHaveBeenCalledWith(polygonUuids);
      expect(clippingService.getOriginalGeometriesGeoJson).toHaveBeenCalledWith(fixablePolygonUuids);
      expect(clippingService.clipPolygons).toHaveBeenCalledWith(fixablePolygonUuids);
      expect(clippingService.buildGeoJsonResponse).toHaveBeenCalledWith(clippedResults);

      expect(result).toEqual({
        originalGeometries: sampleFeatureCollection,
        clippedGeometries: sampleClippedFeatureCollection,
        summary: {
          totalPolygonsProcessed: 1,
          polygonsClipped: 1,
          totalPolygonsRequested: 2,
          message: "Successfully processed 1 fixable polygons from 2 requested, clipped 1 polygons"
        }
      });
    });

    it("should handle case where some requested polygons are not fixable", async () => {
      const requestedUuids = ["polygon-uuid-1", "polygon-uuid-2", "polygon-uuid-3"];
      const fixablePolygonUuids = ["polygon-uuid-1"];
      const payloadMultiple: PolygonListClippingRequestBody = {
        data: {
          type: "polygon-clipping",
          attributes: {
            polygonUuids: requestedUuids
          }
        }
      };
      const clippedResults = [
        {
          polyUuid: "polygon-uuid-1",
          polyName: "Test Polygon 1",
          geometry: sampleMultiPolygon,
          originalArea: 10.5,
          newArea: 10.2,
          areaRemoved: 0.3
        }
      ];

      policyService.authorize.mockResolvedValue(undefined);
      clippingService.filterFixablePolygonsFromList.mockResolvedValue(fixablePolygonUuids);
      clippingService.getOriginalGeometriesGeoJson.mockResolvedValue(sampleFeatureCollection);
      clippingService.clipPolygons.mockResolvedValue(clippedResults);
      clippingService.buildGeoJsonResponse.mockReturnValue(sampleClippedFeatureCollection);

      const result = await controller.createPolygonListClipping(payloadMultiple);

      expect(result.summary.totalPolygonsRequested).toBe(3);
      expect(result.summary.totalPolygonsProcessed).toBe(1);
      expect(result.summary.polygonsClipped).toBe(1);
    });
  });
});
