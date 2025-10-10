import { Test, TestingModule } from "@nestjs/testing";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { SiteValidationQueryDto } from "./dto/site-validation-query.dto";
import { ValidationRequestDto } from "./dto/validation-request.dto";
import { getQueueToken } from "@nestjs/bullmq";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { ValidationType } from "@terramatch-microservices/database/constants";

describe("ValidationController", () => {
  let controller: ValidationController;

  const sampleValidation = new ValidationDto();
  populateDto(sampleValidation, {
    polygonUuid: "7631be34-bbe0-4e1e-b4fe-592677dc4b50",
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
    polygonUuid: "polygon-uuid-123",
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
    polygonUuid: "polygon-uuid-456",
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
    }),
    getSitePolygonUuids: jest.fn().mockResolvedValue(["polygon-1", "polygon-2"])
  };

  const mockQueue = {
    add: jest.fn()
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    jest.spyOn(DelayedJob, "create").mockResolvedValue({
      id: 1,
      uuid: "job-uuid-123",
      name: "",
      totalContent: 0,
      processedContent: 0,
      progressMessage: "",
      metadata: {},
      save: jest.fn().mockResolvedValue(undefined)
    } as unknown as DelayedJob);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ValidationController],
      providers: [
        {
          provide: ValidationService,
          useValue: mockValidationService
        },
        {
          provide: getQueueToken("validation"),
          useValue: mockQueue
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

    it("should throw BadRequestException for invalid criteriaId", async () => {
      const query = { criteriaId: "0" };
      await expect(controller.getSiteValidation(siteUuid, query as unknown as SiteValidationQueryDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should throw BadRequestException for non-integer criteriaId", async () => {
      const query = { criteriaId: "1.5" };
      await expect(controller.getSiteValidation(siteUuid, query as unknown as SiteValidationQueryDto)).rejects.toThrow(
        BadRequestException
      );
    });

    it("should use criteriaId when provided", async () => {
      const query = { criteriaId: 4 };
      await controller.getSiteValidation(siteUuid, query as unknown as SiteValidationQueryDto);
      expect(mockValidationService.getSiteValidations).toHaveBeenCalledWith(siteUuid, 100, 1, 4);
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
        attributes: { polygonUuid: string; criteriaList: unknown[] };
      }>;
      const polygon1Data = dataArray.find(item => item.id === "polygon-1");
      const polygon2Data = dataArray.find(item => item.id === "polygon-2");

      expect(polygon1Data).toBeDefined();
      if (polygon1Data != null) {
        expect(polygon1Data.attributes.polygonUuid).toBe("polygon-1");
        expect(polygon1Data.attributes.criteriaList).toHaveLength(2);
      }

      expect(polygon2Data).toBeDefined();
      if (polygon2Data != null) {
        expect(polygon2Data.attributes.polygonUuid).toBe("polygon-2");
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
          attributes: { polygonUuid: string; criteriaList: unknown[] };
        }>;
        const polygonData = dataArray[0];
        expect(polygonData.attributes.polygonUuid).toBe("polygon-1");
        expect(polygonData.attributes.criteriaList).toHaveLength(1);
      } else {
        const singleData = result.data as unknown as {
          id: string;
          attributes: { polygonUuid: string; criteriaList: unknown[] };
        };
        expect(singleData.attributes.polygonUuid).toBe("polygon-1");
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
          attributes: { polygonUuid: string; criteriaList: unknown[] };
        }>;
        const polygonData = dataArray[0];
        expect(polygonData.attributes.polygonUuid).toBe("polygon-1");
        expect(polygonData.attributes.criteriaList).toHaveLength(1);
      } else {
        const singleData = result.data as unknown as {
          id: string;
          attributes: { polygonUuid: string; criteriaList: unknown[] };
        };
        expect(singleData.attributes.polygonUuid).toBe("polygon-1");
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
          attributes: { polygonUuid: string; criteriaList: unknown[] };
        }>;
        const polygonData = dataArray[0];
        expect(polygonData.attributes.polygonUuid).toBe("polygon-1");
        expect(polygonData.attributes.criteriaList).toHaveLength(1);
      } else {
        const singleData = result.data as unknown as {
          id: string;
          attributes: { polygonUuid: string; criteriaList: unknown[] };
        };
        expect(singleData.attributes.polygonUuid).toBe("polygon-1");
        expect(singleData.attributes.criteriaList).toHaveLength(1);
      }
    });

    it("should create polygon validations with ESTIMATED_AREA validation type", async () => {
      const request: ValidationRequestDto = {
        polygonUuids: ["polygon-1"],
        validationTypes: ["ESTIMATED_AREA"]
      };

      mockValidationService.validatePolygons.mockResolvedValueOnce({
        results: [
          {
            polygonUuid: "polygon-1",
            criteriaId: 12,
            valid: true,
            createdAt: new Date("2025-01-08T22:15:15.000Z"),
            extraInfo: {
              sumAreaSite: 800,
              sumAreaProject: 4000,
              percentageSite: 80,
              percentageProject: 80,
              totalAreaSite: 1000,
              totalAreaProject: 5000,
              lowerBoundSite: 750,
              upperBoundSite: 1250,
              lowerBoundProject: 3750,
              upperBoundProject: 6250
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
          attributes: { polygonUuid: string; criteriaList: unknown[] };
        }>;
        const polygonData = dataArray[0];
        expect(polygonData.attributes.polygonUuid).toBe("polygon-1");
        expect(polygonData.attributes.criteriaList).toHaveLength(1);
      } else {
        const singleData = result.data as unknown as {
          id: string;
          attributes: { polygonUuid: string; criteriaList: unknown[] };
        };
        expect(singleData.attributes.polygonUuid).toBe("polygon-1");
        expect(singleData.attributes.criteriaList).toHaveLength(1);
      }
    });
  });

  describe("createSiteValidation", () => {
    const siteUuid = "site-uuid-123";

    it("should create a site validation job", async () => {
      const request = { validationTypes: ["SELF_INTERSECTION", "SPIKES"] as ValidationType[] };
      const result = serialize(await controller.createSiteValidation(siteUuid, request));

      expect(mockValidationService.getSitePolygonUuids).toHaveBeenCalledWith(siteUuid);
      expect(mockQueue.add).toHaveBeenCalledWith("siteValidation", {
        siteUuid,
        validationTypes: ["SELF_INTERSECTION", "SPIKES"],
        delayedJobId: 1
      });
      expect(result.data).toBeDefined();
    });

    it("should throw NotFoundException when site has no polygons", async () => {
      mockValidationService.getSitePolygonUuids.mockResolvedValueOnce([]);
      const request = { validationTypes: ["SELF_INTERSECTION"] as ValidationType[] };
      await expect(controller.createSiteValidation(siteUuid, request)).rejects.toThrow(NotFoundException);
    });

    it("should use all validation types when none provided", async () => {
      const request = {};
      await controller.createSiteValidation(siteUuid, request);
      expect(mockQueue.add).toHaveBeenCalledWith("siteValidation", expect.objectContaining({ siteUuid }));
    });
  });
});
