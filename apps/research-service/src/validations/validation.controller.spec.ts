import { Test, TestingModule } from "@nestjs/testing";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { SiteValidationQueryDto } from "./dto/site-validation-query.dto";
import { ValidationRequestDto } from "./dto/validation-request.dto";

describe("ValidationController", () => {
  let controller: ValidationController;

  const sampleValidation = new ValidationDto();
  populateDto(sampleValidation, {
    polygonId: "7631be34-bbe0-4e1e-b4fe-592677dc4b50",
    criteriaList: [
      {
        criteriaId: 4,
        valid: true,
        createdAt: new Date("2025-01-08T22:15:15.000Z"),
        extraInfo: null
      },
      {
        criteriaId: 8,
        valid: true,
        createdAt: new Date("2025-01-08T22:15:15.000Z"),
        extraInfo: null
      }
    ]
  });

  const siteValidation1 = new ValidationDto();
  populateDto(siteValidation1, {
    polygonId: "polygon-uuid-123",
    criteriaList: [
      {
        criteriaId: 4,
        valid: true,
        createdAt: new Date("2025-01-08T22:15:15.000Z"),
        extraInfo: null
      }
    ]
  });

  const siteValidation2 = new ValidationDto();
  populateDto(siteValidation2, {
    polygonId: "polygon-uuid-456",
    criteriaList: [
      {
        criteriaId: 8,
        valid: false,
        createdAt: new Date("2025-01-08T22:15:15.000Z"),
        extraInfo: { reason: "Test" }
      }
    ]
  });

  const mockValidationService = {
    getPolygonValidation: jest.fn().mockResolvedValue(sampleValidation),
    getSiteValidations: jest.fn().mockResolvedValue({
      validations: [siteValidation1, siteValidation2],
      total: 2
    }),
    validatePolygons: jest.fn().mockResolvedValue({
      results: [
        {
          polygonUuid: "polygon-1",
          criteriaId: 4,
          valid: true,
          createdAt: new Date("2025-01-08T22:15:15.000Z"),
          extraInfo: null
        },
        {
          polygonUuid: "polygon-1",
          criteriaId: 8,
          valid: false,
          createdAt: new Date("2025-01-08T22:15:15.000Z"),
          extraInfo: { spikes: [], spikeCount: 0 }
        },
        {
          polygonUuid: "polygon-2",
          criteriaId: 4,
          valid: true,
          createdAt: new Date("2025-01-08T22:15:15.000Z"),
          extraInfo: null
        }
      ]
    })
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValidationController],
      providers: [
        {
          provide: ValidationService,
          useValue: mockValidationService
        }
      ]
    }).compile();

    controller = module.get<ValidationController>(ValidationController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getPolygonValidation", () => {
    it("should return validation data for a valid polygon UUID", async () => {
      const polygonUuid = "7631be34-bbe0-4e1e-b4fe-592677dc4b50";

      const result = serialize(await controller.getPolygonValidation(polygonUuid));

      expect(mockValidationService.getPolygonValidation).toHaveBeenCalledWith(polygonUuid);

      expect(result.data).toBeDefined();
    });
  });

  describe("getSiteValidation", () => {
    const siteUuid = "site-uuid-123";

    it("should return validation data for a site with default pagination", async () => {
      const query: SiteValidationQueryDto = {};

      const result = serialize(await controller.getSiteValidation(siteUuid, query));

      expect(mockValidationService.getSiteValidations).toHaveBeenCalledWith(siteUuid, 100, 1, undefined);

      expect(result.data).toBeDefined();
      expect(result.data).toHaveLength(2);
    });

    it("should use pagination parameters when provided", async () => {
      const query: SiteValidationQueryDto = {
        page: {
          size: 10,
          number: 3
        }
      };

      await controller.getSiteValidation(siteUuid, query);

      expect(mockValidationService.getSiteValidations).toHaveBeenCalledWith(siteUuid, 10, 3, undefined);
    });
  });

  describe("createPolygonValidations", () => {
    it("should create polygon validations and return proper JSON API format", async () => {
      const request: ValidationRequestDto = {
        polygonUuids: ["polygon-1", "polygon-2"],
        validationTypes: ["SELF_INTERSECTION", "SPIKES"]
      };

      const result = serialize(await controller.createPolygonValidations(request));

      expect(mockValidationService.validatePolygons).toHaveBeenCalledWith(request);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(2);

      const dataArray = result.data as unknown as Array<{
        id: string;
        attributes: { polygonId: string; criteriaList: unknown[] };
      }>;
      const polygon1Data = dataArray.find(item => item.id === "polygon-1");
      const polygon2Data = dataArray.find(item => item.id === "polygon-2");

      expect(polygon1Data).toBeDefined();
      if (polygon1Data != null) {
        expect(polygon1Data.attributes.polygonId).toBe("polygon-1");
        expect(polygon1Data.attributes.criteriaList).toHaveLength(2);
      }

      expect(polygon2Data).toBeDefined();
      if (polygon2Data != null) {
        expect(polygon2Data.attributes.polygonId).toBe("polygon-2");
        expect(polygon2Data.attributes.criteriaList).toHaveLength(1);
      }
    });

    it("should handle results with null polygonUuid", async () => {
      mockValidationService.validatePolygons.mockResolvedValueOnce({
        results: [
          {
            polygonUuid: null,
            criteriaId: 4,
            valid: true,
            createdAt: new Date("2025-01-08T22:15:15.000Z"),
            extraInfo: null
          },
          {
            polygonUuid: "polygon-1",
            criteriaId: 4,
            valid: true,
            createdAt: new Date("2025-01-08T22:15:15.000Z"),
            extraInfo: null
          }
        ]
      });

      const request: ValidationRequestDto = {
        polygonUuids: ["polygon-1"],
        validationTypes: ["SELF_INTERSECTION"]
      };

      const result = serialize(await controller.createPolygonValidations(request));

      expect(result.data).toBeDefined();
      if (Array.isArray(result.data)) {
        expect(result.data).toHaveLength(1);
        const dataArray = result.data as Array<{ id: string }>;
        expect(dataArray[0].id).toBe("polygon-1");
      } else {
        const singleData = result.data as { id: string };
        expect(singleData.id).toBe("polygon-1");
      }
    });

    it("should create polygon validations with DATA_COMPLETENESS validation type", async () => {
      const request: ValidationRequestDto = {
        polygonUuids: ["polygon-1"],
        validationTypes: ["DATA_COMPLETENESS"]
      };

      mockValidationService.validatePolygons.mockResolvedValueOnce({
        results: [
          {
            polygonUuid: "polygon-1",
            criteriaId: 14,
            valid: false,
            createdAt: new Date("2025-01-08T22:15:15.000Z"),
            extraInfo: {
              validationErrors: [
                { field: "polyName", error: "Field is required", exists: false },
                { field: "practice", error: "Field is required", exists: false }
              ],
              missingFields: ["polyName", "practice"]
            }
          }
        ]
      });

      const result = serialize(await controller.createPolygonValidations(request));

      expect(mockValidationService.validatePolygons).toHaveBeenCalledWith(request);
      expect(result.data).toBeDefined();

      if (Array.isArray(result.data)) {
        expect(result.data).toHaveLength(1);
        const dataArray = result.data as unknown as Array<{
          id: string;
          attributes: { polygonId: string; criteriaList: unknown[] };
        }>;
        const polygonData = dataArray[0];
        expect(polygonData.attributes.polygonId).toBe("polygon-1");
        expect(polygonData.attributes.criteriaList).toHaveLength(1);
      } else {
        const singleData = result.data as unknown as {
          id: string;
          attributes: { polygonId: string; criteriaList: unknown[] };
        };
        expect(singleData.attributes.polygonId).toBe("polygon-1");
        expect(singleData.attributes.criteriaList).toHaveLength(1);
      }
    });

    it("should create polygon validations with PLANT_START_DATE validation type", async () => {
      const request: ValidationRequestDto = {
        polygonUuids: ["polygon-1"],
        validationTypes: ["PLANT_START_DATE"]
      };

      mockValidationService.validatePolygons.mockResolvedValueOnce({
        results: [
          {
            polygonUuid: "polygon-1",
            criteriaId: 15,
            valid: false,
            createdAt: new Date("2025-01-08T22:15:15.000Z"),
            extraInfo: {
              errorType: "DATE_TOO_EARLY",
              polygonUuid: "polygon-1",
              polygonName: "Test Polygon",
              siteName: "Test Site",
              providedValue: "2017-12-31",
              minDate: "2018-01-01"
            }
          }
        ]
      });

      const result = serialize(await controller.createPolygonValidations(request));

      expect(mockValidationService.validatePolygons).toHaveBeenCalledWith(request);
      expect(result.data).toBeDefined();

      if (Array.isArray(result.data)) {
        expect(result.data).toHaveLength(1);
        const dataArray = result.data as unknown as Array<{
          id: string;
          attributes: { polygonId: string; criteriaList: unknown[] };
        }>;
        const polygonData = dataArray[0];
        expect(polygonData.attributes.polygonId).toBe("polygon-1");
        expect(polygonData.attributes.criteriaList).toHaveLength(1);
      } else {
        const singleData = result.data as unknown as {
          id: string;
          attributes: { polygonId: string; criteriaList: unknown[] };
        };
        expect(singleData.attributes.polygonId).toBe("polygon-1");
        expect(singleData.attributes.criteriaList).toHaveLength(1);
      }
    });

    it("should create polygon validations with POLYGON_SIZE validation type", async () => {
      const request: ValidationRequestDto = {
        polygonUuids: ["polygon-1"],
        validationTypes: ["POLYGON_SIZE"]
      };

      mockValidationService.validatePolygons.mockResolvedValueOnce({
        results: [
          {
            polygonUuid: "polygon-1",
            criteriaId: 6,
            valid: false,
            createdAt: new Date("2025-01-08T22:15:15.000Z"),
            extraInfo: {
              areaHectares: 1500,
              maxAllowedHectares: 1000
            }
          }
        ]
      });

      const result = serialize(await controller.createPolygonValidations(request));

      expect(mockValidationService.validatePolygons).toHaveBeenCalledWith(request);
      expect(result.data).toBeDefined();

      if (Array.isArray(result.data)) {
        expect(result.data).toHaveLength(1);
        const dataArray = result.data as unknown as Array<{
          id: string;
          attributes: { polygonId: string; criteriaList: unknown[] };
        }>;
        const polygonData = dataArray[0];
        expect(polygonData.attributes.polygonId).toBe("polygon-1");
        expect(polygonData.attributes.criteriaList).toHaveLength(1);
      } else {
        const singleData = result.data as unknown as {
          id: string;
          attributes: { polygonId: string; criteriaList: unknown[] };
        };
        expect(singleData.attributes.polygonId).toBe("polygon-1");
        expect(singleData.attributes.criteriaList).toHaveLength(1);
      }
    });
  });
});
