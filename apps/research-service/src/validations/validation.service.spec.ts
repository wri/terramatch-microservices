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
import { ValidationType } from "@terramatch-microservices/database/constants";

interface MockCriteriaSite {
  update: jest.MockedFunction<(data: { valid: boolean; extraInfo: object | null }) => Promise<void>>;
  save: jest.MockedFunction<() => Promise<void>>;
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
    save: jest.fn()
  })),
  CriteriaSiteHistoric: jest.fn().mockImplementation(() => ({
    save: jest.fn()
  })),
  SitePolygon: {
    findAndCountAll: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    sum: jest.fn()
  },
  Site: {
    findAll: jest.fn()
  },
  Project: {
    findByPk: jest.fn()
  }
}));

// Mock the static methods
(CriteriaSite as jest.MockedClass<typeof CriteriaSite>).findAll = jest.fn();
(CriteriaSite as jest.MockedClass<typeof CriteriaSite>).findOne = jest.fn();

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
      expect(result.polygonId).toBe(polygonUuid);
      expect(result.criteriaList).toHaveLength(3);
      expect(result.criteriaList[0]).toEqual({
        criteriaId: 3,
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

      expect(result.polygonId).toBe(polygonUuid);
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
      expect(result.validations[0].polygonId).toBe(polygonUuid1);
      expect(result.validations[0].criteriaList).toHaveLength(2);
      expect(result.validations[1].polygonId).toBe(polygonUuid2);
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
      save: jest.fn()
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
        polygonUuid: "uuid-1",
        criteriaId: 4,
        valid: true,
        createdAt: expect.any(Date),
        extraInfo: null
      });
      expect(result.results[1]).toEqual({
        polygonUuid: "uuid-2",
        criteriaId: 4,
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
        polygonUuid: "uuid-1",
        criteriaId: 8,
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
        polygonUuid: "uuid-1",
        criteriaId: 14,
        valid: false,
        createdAt: expect.any(Date),
        extraInfo: expect.objectContaining({
          validationErrors: expect.arrayContaining([
            expect.objectContaining({ field: "polyName", exists: false }),
            expect.objectContaining({ field: "practice", exists: false })
          ]),
          missingFields: expect.arrayContaining(["polyName", "practice"])
        })
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
        polygonUuid: "uuid-1",
        criteriaId: 15,
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
        polygonUuid: "uuid-1",
        criteriaId: 6,
        valid: true,
        createdAt: expect.any(Date),
        extraInfo: {
          areaHectares: 500,
          maxAllowedHectares: 1000
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
      (Site.findAll as jest.Mock).mockResolvedValue([{ uuid: "site-uuid-1" }]);
      (SitePolygon.sum as jest.Mock)
        .mockResolvedValueOnce(800) // Site area sum
        .mockResolvedValueOnce(4000); // Project area sum

      const result = await service.validatePolygons(request);

      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toEqual({
        polygonUuid: "uuid-1",
        criteriaId: 12,
        valid: true,
        createdAt: expect.any(Date),
        extraInfo: expect.objectContaining({
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
        })
      });

      expect(SitePolygon.findOne).toHaveBeenCalledWith({
        where: { polygonUuid: "uuid-1", isActive: true },
        include: [
          {
            model: expect.anything(),
            as: "site",
            attributes: ["hectaresToRestoreGoal"]
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

      expect(CriteriaSite).toHaveBeenCalled();
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
        save: jest.fn()
      };

      (CriteriaSite.findOne as jest.Mock).mockResolvedValue(existingCriteria);
      mockSelfIntersectionValidator.validatePolygon.mockResolvedValue({ valid: true, extraInfo: null });

      await service.validatePolygons(request);

      expect(CriteriaSiteHistoric).toHaveBeenCalled();
      expect(existingCriteria.update).toHaveBeenCalledWith({
        valid: true,
        extraInfo: null
      });
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
      expect(result.validations[0].polygonId).toBe("polygon-1");
    });
  });
});
