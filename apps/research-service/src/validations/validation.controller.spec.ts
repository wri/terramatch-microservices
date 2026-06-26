import { Test, TestingModule } from "@nestjs/testing";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { mockUserContext, serialize } from "@terramatch-microservices/common/util/testing";
import { SiteValidationQueryDto } from "./dto/site-validation-query.dto";
import { ValidationRequestBody } from "./dto/validation-request.dto";
import { SiteValidationRequestBody } from "./dto/site-validation-request.dto";
import { GeometryValidationRequestBody } from "./dto/geometry-validation-request.dto";
import { getQueueToken } from "@nestjs/bullmq";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DelayedJob, Site } from "@terramatch-microservices/database/entities";
import {
  CRITERIA_ID_TO_VALIDATION_TYPE,
  NON_PERSISTENT_VALIDATION_TYPES,
  ValidationType,
  VALIDATION_TYPES
} from "@terramatch-microservices/database/constants";

describe("ValidationController", () => {
  let controller: ValidationController;

  const sampleValidation = new ValidationDto();
  populateDto(sampleValidation, {
    polygonUuid: "7631be34-bbe0-4e1e-b4fe-592677dc4b50",
    criteriaList: [
      {
        criteriaId: 4,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[4],
        valid: true,
        createdAt: new Date("2025-01-08T22:15:15.000Z"),
        extraInfo: null
      },
      {
        criteriaId: 8,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[8],
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
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[4],
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
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[8],
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
    validatePolygonsBatch: jest.fn().mockResolvedValue(undefined),
    getSitePolygonUuids: jest.fn().mockResolvedValue(["polygon-1", "polygon-2"]),
    validateGeometries: jest.fn().mockResolvedValue([
      {
        type: "validation",
        id: "feature-1",
        attributes: {
          polygonUuid: "feature-1",
          criteriaList: [
            {
              criteriaId: 5,
              validationType: CRITERIA_ID_TO_VALIDATION_TYPE[5],
              valid: true,
              createdAt: new Date("2025-01-08T22:15:15.000Z"),
              extraInfo: null
            }
          ]
        }
      }
    ])
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

    jest.spyOn(Site, "findOne").mockResolvedValue({
      id: 1,
      name: "Test Site"
    } as unknown as Site);

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
    it("should create a polygon validation job", async () => {
      const request: ValidationRequestBody = {
        data: {
          type: "validations",
          attributes: {
            polygonUuids: ["polygon-1", "polygon-2"],
            validationTypes: ["SELF_INTERSECTION", "SPIKES"]
          }
        }
      };
      mockUserContext({ userId: 1 });
      const result = serialize(await controller.createPolygonValidations(request));

      expect(mockValidationService.validatePolygonsBatch).not.toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledWith("polygonValidation", {
        polygonUuids: ["polygon-1", "polygon-2"],
        validationTypes: ["SELF_INTERSECTION", "SPIKES"],
        delayedJobId: 1
      });
      expect(result.data).toBeDefined();
    });

    it("uses all validation types when validationTypes is empty", async () => {
      const request: ValidationRequestBody = {
        data: {
          type: "validations",
          attributes: {
            polygonUuids: ["polygon-1"],
            validationTypes: []
          }
        }
      };
      mockUserContext({ userId: 1 });
      await controller.createPolygonValidations(request);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "polygonValidation",
        expect.objectContaining({ validationTypes: VALIDATION_TYPES, polygonUuids: ["polygon-1"] })
      );
    });

    it("uses all validation types when validationTypes is null", async () => {
      const request: ValidationRequestBody = {
        data: {
          type: "validations",
          attributes: {
            polygonUuids: ["polygon-1"],
            validationTypes: null as unknown as ValidationType[]
          }
        }
      };
      mockUserContext({ userId: 1 });
      await controller.createPolygonValidations(request);

      expect(mockQueue.add).toHaveBeenCalledWith(
        "polygonValidation",
        expect.objectContaining({ validationTypes: VALIDATION_TYPES, polygonUuids: ["polygon-1"] })
      );
    });
  });

  describe("createSiteValidation", () => {
    const siteUuid = "site-uuid-123";

    it("should create a site validation job", async () => {
      const request: SiteValidationRequestBody = {
        data: {
          type: "validations",
          attributes: {
            validationTypes: ["SELF_INTERSECTION", "SPIKES"] as ValidationType[]
          }
        }
      };
      mockUserContext({ userId: 1 });
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
      const request: SiteValidationRequestBody = {
        data: {
          type: "validations",
          attributes: {
            validationTypes: ["SELF_INTERSECTION"] as ValidationType[]
          }
        }
      };
      mockUserContext({ userId: 1 });
      await expect(controller.createSiteValidation(siteUuid, request)).rejects.toThrow(NotFoundException);
    });

    it("should use all validation types when none provided", async () => {
      const request: SiteValidationRequestBody = {
        data: {
          type: "validations",
          attributes: {}
        }
      };
      mockUserContext({ userId: 1 });
      await controller.createSiteValidation(siteUuid, request);
      expect(mockQueue.add).toHaveBeenCalledWith("siteValidation", expect.objectContaining({ siteUuid }));
    });

    it("should use all validation types when validationTypes is an empty array", async () => {
      const request: SiteValidationRequestBody = {
        data: {
          type: "validations",
          attributes: { validationTypes: [] }
        }
      };
      mockUserContext({ userId: 1 });
      await controller.createSiteValidation(siteUuid, request);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "siteValidation",
        expect.objectContaining({ validationTypes: VALIDATION_TYPES, siteUuid })
      );
    });

    it("throws NotFoundException when Site lookup returns null after polygons exist", async () => {
      (Site.findOne as jest.Mock).mockResolvedValueOnce(null);
      const request: SiteValidationRequestBody = {
        data: {
          type: "validations",
          attributes: { validationTypes: ["SELF_INTERSECTION"] as ValidationType[] }
        }
      };
      mockUserContext({ userId: 1 });
      await expect(controller.createSiteValidation(siteUuid, request)).rejects.toThrow(NotFoundException);
      expect(DelayedJob.create).not.toHaveBeenCalled();
    });
  });

  describe("validateGeometries", () => {
    it("should validate geometries and return JSON:API format", async () => {
      const request: GeometryValidationRequestBody = {
        data: {
          type: "geometryValidations",
          attributes: {
            geometries: [
              {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: {
                      type: "Polygon",
                      coordinates: [
                        [
                          [0, 0],
                          [0, 1],
                          [1, 1],
                          [1, 0],
                          [0, 0]
                        ]
                      ]
                    },
                    properties: {
                      id: "feature-1",
                      site_id: "site-123",
                      poly_name: "Test Polygon"
                    }
                  }
                ]
              }
            ],
            validationTypes: ["FEATURE_BOUNDS", "GEOMETRY_TYPE"]
          }
        }
      };

      const result = serialize(await controller.validateGeometries(request));

      expect(mockValidationService.validateGeometries).toHaveBeenCalledWith(request.data.attributes.geometries, [
        "FEATURE_BOUNDS",
        "GEOMETRY_TYPE"
      ]);
      expect(result.data).toBeDefined();
      if (Array.isArray(result.data)) {
        expect(result.data).toHaveLength(1);
        expect(result.data[0].id).toBe("feature-1");
      }
    });

    it("should use all validations types when none provided", async () => {
      const request: GeometryValidationRequestBody = {
        data: {
          type: "geometryValidations",
          attributes: {
            geometries: [
              {
                type: "FeatureCollection",
                features: [
                  {
                    type: "Feature",
                    geometry: {
                      type: "Polygon",
                      coordinates: [
                        [
                          [0, 0],
                          [0, 1],
                          [1, 1],
                          [1, 0],
                          [0, 0]
                        ]
                      ]
                    },
                    properties: { id: "feature-1" }
                  }
                ]
              }
            ]
          }
        }
      };

      await controller.validateGeometries(request);

      expect(mockValidationService.validateGeometries).toHaveBeenCalled();
      const callArgs = mockValidationService.validateGeometries.mock.calls[0];
      expect(callArgs[1]).toEqual([...NON_PERSISTENT_VALIDATION_TYPES]);
    });
  });
});
