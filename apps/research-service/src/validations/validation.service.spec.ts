import { Test, TestingModule } from "@nestjs/testing";
import { ValidationService, VALIDATORS } from "./validation.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  CriteriaSite,
  CriteriaSiteHistoric,
  PolygonGeometry,
  SitePolygon,
  Site,
  Project
} from "@terramatch-microservices/database/entities";
import { Literal } from "sequelize/types/utils";
import { ValidationType, CRITERIA_ID_TO_VALIDATION_TYPE } from "@terramatch-microservices/database/constants";
import { Op } from "sequelize";

interface MockCriteriaSite {
  update: jest.MockedFunction<(data: { valid: boolean; extraInfo: object | null }) => Promise<void>>;
  save: jest.MockedFunction<() => Promise<void>>;
  destroy: jest.MockedFunction<() => Promise<void>>;
}

interface MockSelfIntersectionValidator {
  validatePolygon: jest.MockedFunction<(polygonUuid: string) => Promise<{ valid: boolean; extraInfo: object | null }>>;
  validatePolygons: jest.MockedFunction<
    (polygonUuids: string[]) => Promise<Array<{ polygonUuid: string; valid: boolean; extraInfo: object | null }>>
  >;
}

interface MockSpikesValidator {
  validatePolygon: jest.MockedFunction<(polygonUuid: string) => Promise<{ valid: boolean; extraInfo: object | null }>>;
  validatePolygons: jest.MockedFunction<
    (polygonUuids: string[]) => Promise<Array<{ polygonUuid: string; valid: boolean; extraInfo: object | null }>>
  >;
}

jest.mock("@terramatch-microservices/database/entities", () => ({
  PolygonGeometry: {
    findOne: jest.fn(),
    sequelize: {
      query: jest.fn()
    }
  },
  CriteriaSite: jest.fn().mockImplementation(() => ({
    save: jest.fn(),
    destroy: jest.fn()
  })),
  CriteriaSiteHistoric: jest.fn().mockImplementation(() => ({
    save: jest.fn()
  })),
  SitePolygon: {
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    sum: jest.fn(),
    update: jest.fn()
  },
  Site: {
    findAll: jest.fn(),
    uuidsSubquery: jest.fn(),
    findOne: jest.fn()
  },
  Project: {
    findByPk: jest.fn()
  }
}));

// Mock the static methods
(CriteriaSite as jest.MockedClass<typeof CriteriaSite>).findAll = jest.fn();
(CriteriaSite as jest.MockedClass<typeof CriteriaSite>).findOne = jest.fn();
(CriteriaSite as jest.MockedClass<typeof CriteriaSite>).create = jest.fn();
(CriteriaSite as jest.MockedClass<typeof CriteriaSite>).bulkCreate = jest.fn();
(CriteriaSite as jest.MockedClass<typeof CriteriaSite>).destroy = jest.fn();
(CriteriaSiteHistoric as jest.MockedClass<typeof CriteriaSiteHistoric>).bulkCreate = jest.fn();

describe("ValidationService", () => {
  let service: ValidationService;
  let mockSelfIntersectionValidator: MockSelfIntersectionValidator;
  let mockSpikesValidator: MockSpikesValidator;

  const mockCriteriaData = [
    {
      criteriaId: 3,
      valid: true,
      createdAt: new Date("2025-01-08T22:15:15.000Z"),
      extraInfo: null
    },
    {
      criteriaId: 4,
      valid: true,
      createdAt: new Date("2025-01-08T22:15:15.000Z"),
      extraInfo: null
    },
    {
      criteriaId: 12,
      valid: false,
      createdAt: new Date("2025-01-08T22:15:15.000Z"),
      extraInfo: { percentage_site: 53, percentage_project: 19 }
    }
  ];

  beforeEach(async () => {
    jest.clearAllMocks();

    (PolygonGeometry.sequelize?.query as jest.Mock)?.mockResolvedValue([{ is_simple: true }]);
    (CriteriaSite.findAll as jest.Mock).mockResolvedValue([]);

    mockSelfIntersectionValidator = {
      validatePolygon: jest.fn(),
      validatePolygons: jest.fn()
    } as MockSelfIntersectionValidator;

    mockSpikesValidator = {
      validatePolygon: jest.fn(),
      validatePolygons: jest.fn()
    } as MockSpikesValidator;

    (VALIDATORS as Record<string, unknown>).SELF_INTERSECTION = mockSelfIntersectionValidator;
    (VALIDATORS as Record<string, unknown>).SPIKES = mockSpikesValidator;

    const module: TestingModule = await Test.createTestingModule({
      providers: [ValidationService]
    }).compile();

    service = module.get<ValidationService>(ValidationService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getPolygonValidation", () => {
    it("should return validation data for a valid polygon UUID", async () => {
      const polygonUuid = "7631be34-bbe0-4e1e-b4fe-592677dc4b50";

      (PolygonGeometry.findOne as jest.Mock).mockResolvedValue({ uuid: polygonUuid });
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue(mockCriteriaData);

      const result = await service.getPolygonValidation(polygonUuid);

      expect(PolygonGeometry.findOne).toHaveBeenCalledWith({
        where: { uuid: polygonUuid },
        attributes: ["uuid"]
      });

      expect(CriteriaSite.findAll).toHaveBeenCalledWith({
        where: { polygonId: polygonUuid },
        attributes: ["criteriaId", "valid", "createdAt", "extraInfo"],
        order: [["createdAt", "DESC"]]
      });

      expect(result).toBeDefined();
      expect(result.polygonUuid).toBe(polygonUuid);
      expect(result.criteriaList).toHaveLength(3);
      expect(result.criteriaList[0]).toEqual({
        criteriaId: 3,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[3],
        valid: true,
        createdAt: new Date("2025-01-08T22:15:15.000Z"),
        extraInfo: null
      });
    });

    it("should throw NotFoundException when polygon is not found", async () => {
      const nonExistentUuid = "non-existent-uuid";
      (PolygonGeometry.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.getPolygonValidation(nonExistentUuid)).rejects.toThrow(
        new NotFoundException(`Polygon with UUID ${nonExistentUuid} not found`)
      );

      expect(PolygonGeometry.findOne).toHaveBeenCalled();
      expect(CriteriaSite.findAll).not.toHaveBeenCalled();
    });

    it("should return empty criteria list when no validation data exists", async () => {
      const polygonUuid = "7631be34-bbe0-4e1e-b4fe-592677dc4b50";

      (PolygonGeometry.findOne as jest.Mock).mockResolvedValue({ uuid: polygonUuid });
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([]);

      const result = await service.getPolygonValidation(polygonUuid);

      expect(result.polygonUuid).toBe(polygonUuid);
      expect(result.criteriaList).toEqual([]);
    });
  });

  describe("getSiteValidations", () => {
    const siteUuid = "site-uuid-123";
    const polygonUuid1 = "polygon-uuid-123";
    const polygonUuid2 = "polygon-uuid-456";
    const mockPolygons = [{ polygonUuid: polygonUuid1 }, { polygonUuid: polygonUuid2 }];

    const mockCriteria = [
      {
        polygonId: polygonUuid1,
        criteriaId: 1,
        valid: true,
        createdAt: new Date("2025-01-08T22:15:15.000Z"),
        extraInfo: null
      },
      {
        polygonId: polygonUuid1,
        criteriaId: 2,
        valid: false,
        createdAt: new Date("2025-01-08T22:15:15.000Z"),
        extraInfo: { reason: "Test" }
      },
      {
        polygonId: polygonUuid2,
        criteriaId: 1,
        valid: true,
        createdAt: new Date("2025-01-08T22:15:15.000Z"),
        extraInfo: null
      }
    ];

    it("should return validations for all polygons in a site", async () => {
      (SitePolygon.findAll as jest.Mock).mockResolvedValue(mockPolygons);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue(mockCriteria);

      const result = await service.getSiteValidations(siteUuid, 100);

      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: {
          siteUuid,
          isActive: true
        },
        attributes: ["polygonUuid"]
      });

      expect(CriteriaSite.findAll).toHaveBeenCalledWith({
        where: { polygonId: [polygonUuid1, polygonUuid2] },
        attributes: ["polygonId", "criteriaId", "valid", "createdAt", "extraInfo"],
        order: [["createdAt", "DESC"]]
      });

      expect(result.validations).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.validations[0].polygonUuid).toBe(polygonUuid1);
      expect(result.validations[0].criteriaList).toHaveLength(2);
      expect(result.validations[1].polygonUuid).toBe(polygonUuid2);
      expect(result.validations[1].criteriaList).toHaveLength(1);
    });

    it("should paginate results correctly", async () => {
      const pageSize = 100;
      const pageNumber = 2;

      (SitePolygon.findAll as jest.Mock).mockResolvedValue(mockPolygons);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue(mockCriteria);

      await service.getSiteValidations(siteUuid, pageSize, pageNumber);

      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: {
          siteUuid,
          isActive: true
        },
        attributes: ["polygonUuid"]
      });
    });

    it("should throw BadRequestException when page number is invalid", async () => {
      const invalidPageNumber = 0;

      await expect(service.getSiteValidations(siteUuid, 100, invalidPageNumber)).rejects.toThrow(BadRequestException);
    });

    it("should return empty result when site has no polygons", async () => {
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([]);

      const result = await service.getSiteValidations(siteUuid, 100);

      expect(result).toEqual({
        validations: [],
        total: 0
      });

      expect(SitePolygon.findAll).toHaveBeenCalled();
      expect(CriteriaSite.findAll).not.toHaveBeenCalled();
    });

    it("should handle site polygons with missing validation criteria", async () => {
      (SitePolygon.findAll as jest.Mock).mockResolvedValue(mockPolygons);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([mockCriteria[0]]);

      const result = await service.getSiteValidations(siteUuid, 100);

      expect(result.validations).toHaveLength(1);
      expect(result.validations[0].criteriaList).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("validatePolygons", () => {
    const mockCriteriaSite: MockCriteriaSite = {
      update: jest.fn(),
      save: jest.fn(),
      destroy: jest.fn()
    };

    beforeEach(() => {
      (CriteriaSite.findOne as jest.Mock).mockResolvedValue(mockCriteriaSite);
    });

    it("should validate polygons with SELF_INTERSECTION validation type", async () => {
      const request = {
        polygonUuids: ["uuid-1", "uuid-2"],
        validationTypes: ["SELF_INTERSECTION" as ValidationType]
      };

      mockSelfIntersectionValidator.validatePolygon
        .mockResolvedValueOnce({ valid: true, extraInfo: null })
        .mockResolvedValueOnce({ valid: false, extraInfo: null });

      const result = await service.validatePolygons(request);

      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({
        criteriaId: 4,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[4],
        valid: true,
        createdAt: expect.any(Date),
        extraInfo: null
      });
      expect(result.results[1]).toEqual({
        criteriaId: 4,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[4],
        valid: false,
        createdAt: expect.any(Date),
        extraInfo: null
      });

      expect(mockSelfIntersectionValidator.validatePolygon).toHaveBeenCalledTimes(2);
      expect(mockSelfIntersectionValidator.validatePolygon).toHaveBeenCalledWith("uuid-1");
      expect(mockSelfIntersectionValidator.validatePolygon).toHaveBeenCalledWith("uuid-2");
    });

    it("should validate polygons with SPIKES validation type", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["SPIKES" as ValidationType]
      };

      const spikesResult = {
        valid: false,
        extraInfo: {
          spikes: [[33.0532174455731, -2.0235234982835237]],
          spikeCount: 1
        }
      };

      mockSpikesValidator.validatePolygon.mockResolvedValue(spikesResult);

      const result = await service.validatePolygons(request);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        criteriaId: 8,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[8],
        valid: false,
        createdAt: expect.any(Date),
        extraInfo: spikesResult.extraInfo
      });

      expect(mockSpikesValidator.validatePolygon).toHaveBeenCalledWith("uuid-1");
    });

    it("should validate polygons with both validation types", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["SELF_INTERSECTION" as ValidationType, "SPIKES" as ValidationType]
      };

      mockSelfIntersectionValidator.validatePolygon.mockResolvedValue({ valid: true, extraInfo: null });
      mockSpikesValidator.validatePolygon.mockResolvedValue({
        valid: false,
        extraInfo: { spikes: [], spikeCount: 0 }
      });

      const result = await service.validatePolygons(request);

      expect(result.results).toHaveLength(2);
      expect(result.results[0].criteriaId).toBe(4);
      expect(result.results[1].criteriaId).toBe(8);
    });

    it("should validate polygons with DATA_COMPLETENESS validation type", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["DATA_COMPLETENESS" as ValidationType]
      };

      const mockSitePolygon = {
        polyName: null,
        practice: null,
        targetSys: "agroforest",
        distr: "single-line",
        numTrees: 100,
        plantStart: new Date("2023-01-01")
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);

      const result = await service.validatePolygons(request);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        criteriaId: 14,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[14],
        valid: false,
        createdAt: expect.any(Date),
        extraInfo: expect.arrayContaining([
          expect.objectContaining({ field: "poly_name", exists: false }),
          expect.objectContaining({ field: "practice", exists: false })
        ])
      });

      expect(SitePolygon.findOne).toHaveBeenCalledWith({
        where: { polygonUuid: "uuid-1" },
        attributes: ["polyName", "practice", "targetSys", "distr", "numTrees", "plantStart"]
      });
    });

    it("should validate polygons with PLANT_START_DATE validation type", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["PLANT_START_DATE" as ValidationType]
      };

      const mockSitePolygon = {
        polyName: "Test Polygon",
        plantStart: "2020-06-15",
        siteUuid: "site-uuid-1",
        site: {
          name: "Test Site",
          startDate: new Date("2019-01-01")
        }
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);

      const result = await service.validatePolygons(request);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        criteriaId: 15,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[15],
        valid: true,
        createdAt: expect.any(Date),
        extraInfo: null
      });

      expect(SitePolygon.findOne).toHaveBeenCalledWith({
        where: { polygonUuid: "uuid-1" },
        attributes: ["polyName", "plantStart", "siteUuid"],
        include: [
          {
            model: expect.anything(),
            as: "site",
            attributes: ["name", "startDate"]
          }
        ]
      });
    });

    it("should validate polygons with POLYGON_SIZE validation type", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["POLYGON_SIZE" as ValidationType]
      };

      const mockSitePolygon = {
        calcArea: 500
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);

      const result = await service.validatePolygons(request);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        criteriaId: 6,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[6],
        valid: true,
        createdAt: expect.any(Date),
        extraInfo: {
          area_hectares: 500
        }
      });

      expect(SitePolygon.findOne).toHaveBeenCalledWith({
        where: { polygonUuid: "uuid-1", isActive: true },
        attributes: ["calcArea"]
      });
    });

    it("should validate polygons with ESTIMATED_AREA validation type", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["ESTIMATED_AREA" as ValidationType]
      };

      const mockSitePolygon = {
        polygonUuid: "uuid-1",
        loadSite: jest.fn().mockResolvedValue({
          uuid: "site-uuid-1",
          projectId: 1,
          hectaresToRestoreGoal: 1000
        })
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (Project.findByPk as jest.Mock).mockResolvedValue({
        id: 1,
        totalHectaresRestoredGoal: 5000
      });
      (Site.uuidsSubquery as jest.Mock).mockReturnValue("subquery-literal" as unknown as Literal);
      (SitePolygon.sum as jest.Mock)
        .mockResolvedValueOnce(800) // Site area sum
        .mockResolvedValueOnce(4000); // Project area sum

      const result = await service.validatePolygons(request);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        criteriaId: 12,
        validationType: CRITERIA_ID_TO_VALIDATION_TYPE[12],
        valid: true,
        createdAt: expect.any(Date),
        extraInfo: expect.objectContaining({
          sum_area_site: 800,
          sum_area_project: 4000,
          percentage_site: 80,
          percentage_project: 80,
          total_area_site: 1000,
          total_area_project: 5000
        })
      });

      expect(SitePolygon.findOne).toHaveBeenCalledWith({
        where: { polygonUuid: "uuid-1", isActive: true },
        include: [
          {
            model: expect.anything(),
            as: "site",
            attributes: ["hectaresToRestoreGoal", "projectId"]
          }
        ]
      });
    });

    it("should validate polygon with SELF_INTERSECTION when specified", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["SELF_INTERSECTION" as ValidationType]
      };

      mockSelfIntersectionValidator.validatePolygon.mockResolvedValue({ valid: true, extraInfo: null });

      const result = await service.validatePolygons(request);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].criteriaId).toBe(4);
      expect(mockSelfIntersectionValidator.validatePolygon).toHaveBeenCalledWith("uuid-1");
    });

    it("should save validation results to database", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["SELF_INTERSECTION" as ValidationType]
      };

      mockSelfIntersectionValidator.validatePolygon.mockResolvedValue({ valid: true, extraInfo: null });

      await service.validatePolygons(request);

      expect(CriteriaSite.findOne).toHaveBeenCalledWith({
        where: {
          polygonId: "uuid-1",
          criteriaId: 4
        }
      });
    });

    it("should create new criteria record when none exists", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["SELF_INTERSECTION" as ValidationType]
      };

      (CriteriaSite.findOne as jest.Mock).mockResolvedValue(null);
      mockSelfIntersectionValidator.validatePolygon.mockResolvedValue({ valid: true, extraInfo: null });

      await service.validatePolygons(request);

      expect(CriteriaSite.create).toHaveBeenCalled();
    });

    it("should update existing criteria record and create historic record", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["SELF_INTERSECTION" as ValidationType]
      };

      const existingCriteria: MockCriteriaSite & { valid: boolean; extraInfo: object } = {
        valid: false,
        extraInfo: { old: "data" },
        update: jest.fn(),
        save: jest.fn(),
        destroy: jest.fn()
      };

      (CriteriaSite.findOne as jest.Mock).mockResolvedValue(existingCriteria);
      mockSelfIntersectionValidator.validatePolygon.mockResolvedValue({ valid: true, extraInfo: null });

      await service.validatePolygons(request);

      expect(CriteriaSiteHistoric).toHaveBeenCalledWith();
      expect(existingCriteria.destroy).toHaveBeenCalled();
      expect(CriteriaSite.create).toHaveBeenCalledTimes(1); // Once for new record
    });

    it("should handle validator errors gracefully", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["SELF_INTERSECTION" as ValidationType]
      };

      const validatorError = new Error("PolygonGeometry model is missing sequelize connection");
      mockSelfIntersectionValidator.validatePolygon.mockRejectedValue(validatorError);

      await expect(service.validatePolygons(request)).rejects.toThrow(validatorError);
    });

    it("should throw BadRequestException for unknown validation type", async () => {
      const request = {
        polygonUuids: ["uuid-1"],
        validationTypes: ["UNKNOWN_TYPE" as ValidationType]
      };

      await expect(service.validatePolygons(request)).rejects.toThrow(
        new BadRequestException("Unknown validation type: UNKNOWN_TYPE")
      );
    });
  });

  describe("getSiteValidations - edge cases", () => {
    it("should throw BadRequestException for invalid page size (too large)", async () => {
      await expect(service.getSiteValidations("site-uuid", 1001, 1)).rejects.toThrow(
        new BadRequestException("Invalid page size: 1001")
      );
    });

    it("should throw BadRequestException for invalid page size (less than 1)", async () => {
      await expect(service.getSiteValidations("site-uuid", 0, 1)).rejects.toThrow(
        new BadRequestException("Invalid page size: 0")
      );
    });

    it("should throw BadRequestException for invalid page number", async () => {
      await expect(service.getSiteValidations("site-uuid", 10, 0)).rejects.toThrow(
        new BadRequestException("Invalid page number: 0")
      );
    });

    it("should filter by criteriaId when provided", async () => {
      const siteUuid = "site-uuid-123";
      const criteriaId = 4;

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([
        { polygonUuid: "polygon-1" },
        { polygonUuid: "polygon-2" }
      ]);

      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([
        {
          polygonId: "polygon-1",
          criteriaId: 4,
          valid: false,
          createdAt: new Date(),
          extraInfo: null
        },
        {
          polygonId: "polygon-1",
          criteriaId: 8,
          valid: true,
          createdAt: new Date(),
          extraInfo: null
        },
        {
          polygonId: "polygon-2",
          criteriaId: 4,
          valid: true,
          createdAt: new Date(),
          extraInfo: null
        }
      ]);

      const result = await service.getSiteValidations(siteUuid, 10, 1, criteriaId);

      expect(result.total).toBe(1); // Only polygon-1 has criteriaId=4 with valid=false
      expect(result.validations).toHaveLength(1);
      expect(result.validations[0].polygonUuid).toBe("polygon-1");
    });
  });

  describe("getSitePolygonUuids", () => {
    it("should return polygon UUIDs for a site", async () => {
      (Site.findOne as jest.Mock).mockResolvedValue({ uuid: "site-uuid" });
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([
        { polygonUuid: "polygon-1" },
        { polygonUuid: "polygon-2" }
      ]);

      const result = await service.getSitePolygonUuids("site-uuid");

      expect(result).toEqual(["polygon-1", "polygon-2"]);
    });

    it("should throw NotFoundException when site not found", async () => {
      (Site.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.getSitePolygonUuids("non-existent")).rejects.toThrow(NotFoundException);
    });

    it("should filter out empty polygon UUIDs", async () => {
      (Site.findOne as jest.Mock).mockResolvedValue({ uuid: "site-uuid" });
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([
        { polygonUuid: "polygon-1" },
        { polygonUuid: "" },
        { polygonUuid: null }
      ]);

      const result = await service.getSitePolygonUuids("site-uuid");

      expect(result).toEqual(["polygon-1"]);
    });
  });

  describe("validatePolygonsBatch", () => {
    it("should use batch validation when available", async () => {
      mockSelfIntersectionValidator.validatePolygons.mockResolvedValue([
        { polygonUuid: "uuid-1", valid: true, extraInfo: null },
        { polygonUuid: "uuid-2", valid: false, extraInfo: null }
      ]);

      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([]);
      (CriteriaSite as jest.MockedClass<typeof CriteriaSite>).bulkCreate = jest.fn().mockResolvedValue(undefined);

      await service.validatePolygonsBatch(["uuid-1", "uuid-2"], ["SELF_INTERSECTION"]);

      expect(mockSelfIntersectionValidator.validatePolygons).toHaveBeenCalledWith(["uuid-1", "uuid-2"]);
    });

    it("should throw BadRequestException for duplicate results from validator", async () => {
      mockSelfIntersectionValidator.validatePolygons.mockResolvedValue([
        { polygonUuid: "uuid-1", valid: true, extraInfo: null },
        { polygonUuid: "uuid-1", valid: false, extraInfo: null }
      ]);

      await expect(service.validatePolygonsBatch(["uuid-1"], ["SELF_INTERSECTION"])).rejects.toThrow(
        BadRequestException
      );
    });

    it("should fall back to single validation when batch not available", async () => {
      (VALIDATORS as Record<string, unknown>).POLYGON_SIZE = { validatePolygon: jest.fn() };
      (
        (VALIDATORS as Record<string, unknown>).POLYGON_SIZE as { validatePolygon: jest.Mock }
      ).validatePolygon.mockResolvedValue({
        valid: true,
        extraInfo: null
      });

      (SitePolygon.findOne as jest.Mock).mockResolvedValue({ calcArea: 500 });
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([]);
      (CriteriaSite as jest.MockedClass<typeof CriteriaSite>).bulkCreate = jest.fn().mockResolvedValue(undefined);

      await service.validatePolygonsBatch(["uuid-1"], ["POLYGON_SIZE"]);

      expect(
        ((VALIDATORS as Record<string, unknown>).POLYGON_SIZE as { validatePolygon: jest.Mock }).validatePolygon
      ).toHaveBeenCalledWith("uuid-1");
    });
  });

  describe("saveValidationResultsBatch", () => {
    beforeEach(() => {
      (CriteriaSite as jest.MockedClass<typeof CriteriaSite>).bulkCreate = jest.fn().mockResolvedValue(undefined);
      (CriteriaSite as jest.MockedClass<typeof CriteriaSite>).destroy = jest.fn().mockResolvedValue(undefined);
      (CriteriaSiteHistoric as jest.MockedClass<typeof CriteriaSiteHistoric>).bulkCreate = jest
        .fn()
        .mockResolvedValue(undefined);
    });

    it("should handle empty results", async () => {
      await service.saveValidationResultsBatch([]);
      expect(CriteriaSite.findAll).not.toHaveBeenCalled();
    });

    it("should create new records when none exist", async () => {
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([]);

      await service.saveValidationResultsBatch([
        { polygonUuid: "uuid-1", criteriaId: 4, valid: true, extraInfo: null }
      ]);

      expect(CriteriaSite.bulkCreate).toHaveBeenCalledWith(
        [{ polygonId: "uuid-1", criteriaId: 4, valid: true, extraInfo: null }],
        { validate: true }
      );
    });

    it("should update existing records and create historic records", async () => {
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([
        { id: 1, polygonId: "uuid-1", criteriaId: 4, valid: false, extraInfo: { old: "data" } }
      ]);

      await service.saveValidationResultsBatch([
        { polygonUuid: "uuid-1", criteriaId: 4, valid: true, extraInfo: null }
      ]);

      expect(CriteriaSiteHistoric.bulkCreate).toHaveBeenCalled();
      expect(CriteriaSite.destroy).toHaveBeenCalled();
      expect(CriteriaSite.bulkCreate).toHaveBeenCalled();
    });

    it("should deduplicate results with same polygon and criteria", async () => {
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([]);

      await service.saveValidationResultsBatch([
        { polygonUuid: "uuid-1", criteriaId: 4, valid: true, extraInfo: null },
        { polygonUuid: "uuid-1", criteriaId: 4, valid: false, extraInfo: null }
      ]);

      expect(CriteriaSite.bulkCreate).toHaveBeenCalledWith(
        [{ polygonId: "uuid-1", criteriaId: 4, valid: false, extraInfo: null }],
        { validate: true }
      );
    });
  });

  describe("updateSitePolygonValidityBatch", () => {
    it("should handle empty polygon UUIDs array", async () => {
      await (
        service as unknown as { updateSitePolygonValidityBatch: (uuids: string[]) => Promise<void> }
      ).updateSitePolygonValidityBatch([]);

      expect(SitePolygon.findAll).not.toHaveBeenCalled();
    });

    it("should handle no SitePolygons found", async () => {
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([]);

      await (
        service as unknown as { updateSitePolygonValidityBatch: (uuids: string[]) => Promise<void> }
      ).updateSitePolygonValidityBatch(["polygon-1"]);

      expect(SitePolygon.findAll).toHaveBeenCalledWith({
        where: {
          polygonUuid: { [Op.in]: ["polygon-1"] },
          isActive: true
        }
      });
      expect(CriteriaSite.findAll).not.toHaveBeenCalled();
    });

    it("should set validation status to null when no criteria exist", async () => {
      const mockSitePolygon = {
        id: 1,
        polygonUuid: "polygon-1",
        validationStatus: "passed"
      };

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([mockSitePolygon]);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([]);
      (SitePolygon.update as jest.Mock).mockResolvedValue(undefined);

      await (
        service as unknown as { updateSitePolygonValidityBatch: (uuids: string[]) => Promise<void> }
      ).updateSitePolygonValidityBatch(["polygon-1"]);

      expect(SitePolygon.update).toHaveBeenCalledWith({ validationStatus: null }, { where: { id: 1 } });
    });

    it("should set validation status to 'passed' when all criteria pass", async () => {
      const mockSitePolygon = {
        id: 1,
        polygonUuid: "polygon-1",
        validationStatus: null
      };

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([mockSitePolygon]);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([
        { polygonId: "polygon-1", criteriaId: 3, valid: true },
        { polygonId: "polygon-1", criteriaId: 4, valid: true }
      ]);
      (SitePolygon.update as jest.Mock).mockResolvedValue(undefined);

      await (
        service as unknown as { updateSitePolygonValidityBatch: (uuids: string[]) => Promise<void> }
      ).updateSitePolygonValidityBatch(["polygon-1"]);

      expect(SitePolygon.update).toHaveBeenCalledWith({ validationStatus: "passed" }, { where: { id: 1 } });
    });

    it("should set validation status to 'failed' when non-excluded criteria fail", async () => {
      const mockSitePolygon = {
        id: 1,
        polygonUuid: "polygon-1",
        validationStatus: "passed"
      };

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([mockSitePolygon]);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([
        { polygonId: "polygon-1", criteriaId: 3, valid: true }, // Non-excluded, passing
        { polygonId: "polygon-1", criteriaId: 4, valid: false } // Non-excluded, failing
      ]);
      (SitePolygon.update as jest.Mock).mockResolvedValue(undefined);

      await (
        service as unknown as { updateSitePolygonValidityBatch: (uuids: string[]) => Promise<void> }
      ).updateSitePolygonValidityBatch(["polygon-1"]);

      expect(SitePolygon.update).toHaveBeenCalledWith({ validationStatus: "failed" }, { where: { id: 1 } });
    });

    it("should set validation status to 'partial' when only excluded criteria fail", async () => {
      const mockSitePolygon = {
        id: 1,
        polygonUuid: "polygon-1",
        validationStatus: "passed"
      };

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([mockSitePolygon]);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([
        { polygonId: "polygon-1", criteriaId: 7, valid: false }, // WITHIN_COUNTRY - excluded criteria, failing
        { polygonId: "polygon-1", criteriaId: 12, valid: false } // ESTIMATED_AREA - excluded criteria, failing
      ]);
      (SitePolygon.update as jest.Mock).mockResolvedValue(undefined);

      await (
        service as unknown as { updateSitePolygonValidityBatch: (uuids: string[]) => Promise<void> }
      ).updateSitePolygonValidityBatch(["polygon-1"]);

      expect(SitePolygon.update).toHaveBeenCalledWith({ validationStatus: "partial" }, { where: { id: 1 } });
    });

    it("should set validation status to 'failed' when both excluded and non-excluded criteria fail", async () => {
      const mockSitePolygon = {
        id: 1,
        polygonUuid: "polygon-1",
        validationStatus: "passed"
      };

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([mockSitePolygon]);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([
        { polygonId: "polygon-1", criteriaId: 7, valid: false }, // WITHIN_COUNTRY - excluded criteria, failing
        { polygonId: "polygon-1", criteriaId: 4, valid: false } // SELF_INTERSECTION - non-excluded criteria, failing
      ]);
      (SitePolygon.update as jest.Mock).mockResolvedValue(undefined);

      await (
        service as unknown as { updateSitePolygonValidityBatch: (uuids: string[]) => Promise<void> }
      ).updateSitePolygonValidityBatch(["polygon-1"]);

      expect(SitePolygon.update).toHaveBeenCalledWith({ validationStatus: "failed" }, { where: { id: 1 } });
    });

    it("should not update when validation status does not need updating", async () => {
      const mockSitePolygon = {
        id: 1,
        polygonUuid: "polygon-1",
        validationStatus: "passed"
      };

      (SitePolygon.findAll as jest.Mock).mockResolvedValue([mockSitePolygon]);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([
        { polygonId: "polygon-1", criteriaId: 3, valid: true },
        { polygonId: "polygon-1", criteriaId: 4, valid: true }
      ]);

      await (
        service as unknown as { updateSitePolygonValidityBatch: (uuids: string[]) => Promise<void> }
      ).updateSitePolygonValidityBatch(["polygon-1"]);

      expect(SitePolygon.update).not.toHaveBeenCalled();
    });

    it("should handle multiple polygons in batch", async () => {
      const mockSitePolygons = [
        { id: 1, polygonUuid: "polygon-1", validationStatus: "passed" },
        { id: 2, polygonUuid: "polygon-2", validationStatus: null }
      ];

      (SitePolygon.findAll as jest.Mock).mockResolvedValue(mockSitePolygons);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([
        { polygonId: "polygon-1", criteriaId: 4, valid: false }, // polygon-1 fails
        { polygonId: "polygon-2", criteriaId: 4, valid: true } // polygon-2 passes
      ]);
      (SitePolygon.update as jest.Mock).mockResolvedValue(undefined);

      await (
        service as unknown as { updateSitePolygonValidityBatch: (uuids: string[]) => Promise<void> }
      ).updateSitePolygonValidityBatch(["polygon-1", "polygon-2"]);

      expect(SitePolygon.update).toHaveBeenCalledTimes(2);
      expect(SitePolygon.update).toHaveBeenCalledWith({ validationStatus: "failed" }, { where: { id: 1 } });
      expect(SitePolygon.update).toHaveBeenCalledWith({ validationStatus: "passed" }, { where: { id: 2 } });
    });
  });

  describe("validateGeometries", () => {
    let mockFeatureBoundsValidator: { validateGeometry: jest.MockedFunction<any> };
    let mockGeometryTypeValidator: { validateGeometry: jest.MockedFunction<any> };
    let mockPolygonSizeValidator: { validateGeometry: jest.MockedFunction<any> };
    let mockSelfIntersectionValidatorGeometry: { validateGeometry: jest.MockedFunction<any> };
    let mockSpikesValidatorGeometry: { validateGeometry: jest.MockedFunction<any> };
    let mockDataCompletenessValidator: { validateGeometry: jest.MockedFunction<any> };
    let mockDuplicateGeometryValidator: { validateGeometry: jest.MockedFunction<any> };

    beforeEach(() => {
      mockFeatureBoundsValidator = {
        validateGeometry: jest.fn()
      };
      mockGeometryTypeValidator = {
        validateGeometry: jest.fn()
      };
      mockPolygonSizeValidator = {
        validateGeometry: jest.fn()
      };
      mockSelfIntersectionValidatorGeometry = {
        validateGeometry: jest.fn()
      };
      mockSpikesValidatorGeometry = {
        validateGeometry: jest.fn()
      };
      mockDataCompletenessValidator = {
        validateGeometry: jest.fn()
      };
      mockDuplicateGeometryValidator = {
        validateGeometry: jest.fn()
      };

      (VALIDATORS as Record<string, unknown>).FEATURE_BOUNDS = mockFeatureBoundsValidator;
      (VALIDATORS as Record<string, unknown>).GEOMETRY_TYPE = mockGeometryTypeValidator;
      (VALIDATORS as Record<string, unknown>).POLYGON_SIZE = mockPolygonSizeValidator;
      (VALIDATORS as Record<string, unknown>).SELF_INTERSECTION = {
        ...mockSelfIntersectionValidator,
        validateGeometry: mockSelfIntersectionValidatorGeometry.validateGeometry
      };
      (VALIDATORS as Record<string, unknown>).SPIKES = {
        ...mockSpikesValidator,
        validateGeometry: mockSpikesValidatorGeometry.validateGeometry
      };
      (VALIDATORS as Record<string, unknown>).DATA_COMPLETENESS = mockDataCompletenessValidator;
      (VALIDATORS as Record<string, unknown>).DUPLICATE_GEOMETRY = mockDuplicateGeometryValidator;
    });

    it("should validate geometries with FEATURE_BOUNDS validator - valid coordinates", async () => {
      const validPolygon = {
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
      };

      mockFeatureBoundsValidator.validateGeometry.mockResolvedValue({
        valid: true,
        extraInfo: null
      });
      mockGeometryTypeValidator.validateGeometry.mockResolvedValue({
        valid: true,
        extraInfo: null
      });

      const result = await service.validateGeometries([validPolygon], ["FEATURE_BOUNDS", "GEOMETRY_TYPE"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.polygonUuid).toBe("feature-1");
      expect(result[0].attributes.criteriaList).toHaveLength(2);
      expect(result[0].attributes.criteriaList[0].valid).toBe(true);
      expect(result[0].attributes.criteriaList[1].valid).toBe(true);
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
    });

    it("should validate geometries with FEATURE_BOUNDS validator - invalid coordinates", async () => {
      const invalidPolygon = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [200, 0],
                  [0, 100],
                  [1, 1],
                  [1, 0],
                  [200, 0]
                ]
              ]
            },
            properties: { id: "feature-1" }
          }
        ]
      };

      mockFeatureBoundsValidator.validateGeometry.mockResolvedValue({
        valid: false,
        extraInfo: {
          invalidCoordinates: [
            { longitude: 200, latitude: 0, reason: "Longitude 200 is outside valid range [-180, 180]" },
            { longitude: 0, latitude: 100, reason: "Latitude 100 is outside valid range [-90, 90]" }
          ]
        }
      });
      mockGeometryTypeValidator.validateGeometry.mockResolvedValue({
        valid: true,
        extraInfo: null
      });

      const result = await service.validateGeometries([invalidPolygon], ["FEATURE_BOUNDS", "GEOMETRY_TYPE"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].valid).toBe(false);
      expect(result[0].attributes.criteriaList[0].extraInfo).toHaveProperty("invalidCoordinates");
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
    });

    it("should validate geometries with GEOMETRY_TYPE validator - valid type", async () => {
      const validPolygon = {
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
      };

      mockGeometryTypeValidator.validateGeometry.mockResolvedValue({
        valid: true,
        extraInfo: null
      });

      const result = await service.validateGeometries([validPolygon], ["GEOMETRY_TYPE"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].valid).toBe(true);
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
    });

    it("should validate geometries with GEOMETRY_TYPE validator - invalid type", async () => {
      const invalidGeometry = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [0, 0],
                [1, 1]
              ]
            },
            properties: { id: "feature-1" }
          }
        ]
      };

      mockGeometryTypeValidator.validateGeometry.mockResolvedValue({
        valid: false,
        extraInfo: {
          actualType: "LineString",
          validTypes: ["Polygon", "MultiPolygon", "Point"]
        }
      });

      const result = await service.validateGeometries([invalidGeometry], ["GEOMETRY_TYPE"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].valid).toBe(false);
      expect(result[0].attributes.criteriaList[0].extraInfo).toHaveProperty("actualType", "LineString");
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
    });

    it("should validate geometries with POLYGON_SIZE validator", async () => {
      const validPolygon = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [0, 0],
                  [0, 0.01],
                  [0.01, 0.01],
                  [0.01, 0],
                  [0, 0]
                ]
              ]
            },
            properties: { id: "feature-1" }
          }
        ]
      };

      (PolygonGeometry.sequelize?.query as jest.Mock).mockResolvedValue([{ area: 0.0001, latitude: 0.005 }]);

      mockPolygonSizeValidator.validateGeometry.mockResolvedValue({
        valid: true,
        extraInfo: { area_hectares: 0.1 }
      });

      const result = await service.validateGeometries([validPolygon], ["POLYGON_SIZE"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].valid).toBe(true);
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
    });

    it("should validate geometries with SELF_INTERSECTION validator", async () => {
      const validPolygon = {
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
      };

      (PolygonGeometry.sequelize?.query as jest.Mock).mockResolvedValue([{ isSimple: true }]);

      mockSelfIntersectionValidatorGeometry.validateGeometry.mockResolvedValue({
        valid: true,
        extraInfo: null
      });

      const result = await service.validateGeometries([validPolygon], ["SELF_INTERSECTION"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].valid).toBe(true);
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
    });

    it("should validate geometries with DATA_COMPLETENESS validator - valid data", async () => {
      const validFeature = {
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
              poly_name: "Test Polygon",
              practice: "tree-planting",
              target_sys: "agroforest",
              distr: "single-line",
              num_trees: 100,
              plantstart: "2023-01-01"
            }
          }
        ]
      };

      mockDataCompletenessValidator.validateGeometry.mockResolvedValue({
        valid: true,
        extraInfo: null
      });

      const result = await service.validateGeometries([validFeature], ["DATA_COMPLETENESS"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].valid).toBe(true);
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
    });

    it("should validate geometries with DATA_COMPLETENESS validator - missing fields", async () => {
      const invalidFeature = {
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
              id: "feature-1"
            }
          }
        ]
      };

      mockDataCompletenessValidator.validateGeometry.mockResolvedValue({
        valid: false,
        extraInfo: [
          { field: "Polygon Name", error: "Polygon name is required", exists: false },
          { field: "Practice", error: "Practice is required", exists: false }
        ]
      });

      const result = await service.validateGeometries([invalidFeature], ["DATA_COMPLETENESS"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].valid).toBe(false);
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
    });

    it("should validate multiple features in a single FeatureCollection", async () => {
      const featureCollection = {
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
          },
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [0.5, 0.5]
            },
            properties: { id: "feature-2" }
          }
        ]
      };

      mockGeometryTypeValidator.validateGeometry
        .mockResolvedValueOnce({ valid: true, extraInfo: null })
        .mockResolvedValueOnce({ valid: true, extraInfo: null });

      const result = await service.validateGeometries([featureCollection], ["GEOMETRY_TYPE"]);

      expect(result).toHaveLength(2);
      expect(result[0].attributes.polygonUuid).toBe("feature-1");
      expect(result[1].attributes.polygonUuid).toBe("feature-2");
      expect(mockGeometryTypeValidator.validateGeometry).toHaveBeenCalledTimes(2);
    });

    it("should handle features without id in properties", async () => {
      const featureCollection = {
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
            properties: {}
          }
        ]
      };

      mockGeometryTypeValidator.validateGeometry.mockResolvedValue({
        valid: true,
        extraInfo: null
      });

      const result = await service.validateGeometries([featureCollection], ["GEOMETRY_TYPE"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.polygonUuid).toBe("feature-0");
    });

    it("should handle validator errors gracefully", async () => {
      const featureCollection = {
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
      };

      mockGeometryTypeValidator.validateGeometry.mockRejectedValue(new Error("Validator error"));

      const result = await service.validateGeometries([featureCollection], ["GEOMETRY_TYPE"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].valid).toBe(false);
      expect(result[0].attributes.criteriaList[0].extraInfo).toHaveProperty("error", "Validator error");
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
    });

    it("should skip validators that don't support validateGeometry", async () => {
      const featureCollection = {
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
      };

      // Create a validator without validateGeometry method
      const validatorWithoutGeometry = {
        validatePolygon: jest.fn()
      };
      (VALIDATORS as Record<string, unknown>).SELF_INTERSECTION = validatorWithoutGeometry;
      (VALIDATORS as Record<string, unknown>).GEOMETRY_TYPE = mockGeometryTypeValidator;

      mockGeometryTypeValidator.validateGeometry.mockResolvedValue({
        valid: true,
        extraInfo: null
      });

      const result = await service.validateGeometries([featureCollection], ["SELF_INTERSECTION", "GEOMETRY_TYPE"]);

      expect(result).toHaveLength(1);
      // Only GEOMETRY_TYPE should be validated
      expect(result[0].attributes.criteriaList).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].criteriaId).toBe(10); // GEOMETRY_TYPE criteriaId
    });

    it("should ensure all valid fields are boolean type", async () => {
      const featureCollection = {
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
      };

      // Mock validators to return different truthy/falsy values
      mockFeatureBoundsValidator.validateGeometry.mockResolvedValue({
        valid: 1 as any, // Simulate database returning 1
        extraInfo: null
      });
      mockGeometryTypeValidator.validateGeometry.mockResolvedValue({
        valid: 0 as any, // Simulate database returning 0
        extraInfo: null
      });

      const result = await service.validateGeometries([featureCollection], ["FEATURE_BOUNDS", "GEOMETRY_TYPE"]);

      expect(result).toHaveLength(1);
      expect(result[0].attributes.criteriaList[0].valid).toBe(true);
      expect(result[0].attributes.criteriaList[1].valid).toBe(false);
      expect(typeof result[0].attributes.criteriaList[0].valid).toBe("boolean");
      expect(typeof result[0].attributes.criteriaList[1].valid).toBe("boolean");
    });
  });
});
