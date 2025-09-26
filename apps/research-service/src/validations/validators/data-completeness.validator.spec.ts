import { Test, TestingModule } from "@nestjs/testing";
import { DataCompletenessValidator } from "./data-completeness.validator";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";

describe("DataCompletenessValidator", () => {
  let validator: DataCompletenessValidator;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DataCompletenessValidator]
    }).compile();

    validator = module.get<DataCompletenessValidator>(DataCompletenessValidator);
  });

  describe("validatePolygon", () => {
    it("should return valid when all required fields are present and valid", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: "tree-planting",
        targetSys: "agroforest",
        distr: "single-line",
        numTrees: 100,
        plantStart: new Date("2023-01-01")
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toEqual({
        validationErrors: [],
        missingFields: []
      });
    });

    it("should return invalid when required fields are missing", async () => {
      const mockSitePolygon = {
        polyName: null,
        practice: null,
        targetSys: null,
        distr: null,
        numTrees: null,
        plantStart: null
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo?.validationErrors).toHaveLength(6);
      expect(result.extraInfo?.missingFields).toHaveLength(6);
    });

    it("should return invalid when fields have invalid values", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: "invalid-practice",
        targetSys: "invalid-system",
        distr: "invalid-distribution",
        numTrees: -5,
        plantStart: "invalid-date"
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo?.validationErrors).toHaveLength(5);
      expect(result.extraInfo?.validationErrors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "practice", exists: true }),
          expect.objectContaining({ field: "targetSys", exists: true }),
          expect.objectContaining({ field: "distr", exists: true }),
          expect.objectContaining({ field: "numTrees", exists: true }),
          expect.objectContaining({ field: "plantStart", exists: true })
        ])
      );
    });

    it("should handle multiple valid practices", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: "tree-planting,direct-seeding",
        targetSys: "agroforest",
        distr: "single-line",
        numTrees: 100,
        plantStart: new Date("2023-01-01")
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
    });

    it("should handle multiple valid target systems", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: "tree-planting",
        targetSys: "agroforest,grassland",
        distr: "single-line",
        numTrees: 100,
        plantStart: new Date("2023-01-01")
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
    });

    it("should handle multiple valid distributions", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: "tree-planting",
        targetSys: "agroforest",
        distr: "single-line,partial",
        numTrees: 100,
        plantStart: new Date("2023-01-01")
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
    });

    it("should handle string date format", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: "tree-planting",
        targetSys: "agroforest",
        distr: "single-line",
        numTrees: 100,
        plantStart: "2023-01-01"
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
    });

    it("should throw NotFoundException when site polygon is not found", async () => {
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);

      await expect(validator.validatePolygon("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should handle empty string values as invalid", async () => {
      const mockSitePolygon = {
        polyName: "",
        practice: "",
        targetSys: "",
        distr: "",
        numTrees: "",
        plantStart: ""
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo?.validationErrors).toHaveLength(6);
      expect(result.extraInfo?.missingFields).toHaveLength(6);
    });

    it("should handle zero numTrees as valid", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: "tree-planting",
        targetSys: "agroforest",
        distr: "single-line",
        numTrees: 0,
        plantStart: new Date("2023-01-01")
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
    });

    it("should handle negative numTrees as invalid", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: "tree-planting",
        targetSys: "agroforest",
        distr: "single-line",
        numTrees: -1,
        plantStart: new Date("2023-01-01")
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo?.validationErrors).toHaveLength(1);
      expect(result.extraInfo?.validationErrors[0]).toEqual({
        field: "numTrees",
        error: "Invalid number of trees. Must be a valid integer",
        exists: true
      });
    });
  });

  describe("validatePolygons", () => {
    it("should validate multiple polygons correctly", async () => {
      const mockSitePolygons = [
        {
          polygonUuid: "uuid-1",
          polyName: "Test Polygon 1",
          practice: "tree-planting",
          targetSys: "agroforest",
          distr: "single-line",
          numTrees: 100,
          plantStart: new Date("2023-01-01")
        },
        {
          polygonUuid: "uuid-2",
          polyName: null,
          practice: null,
          targetSys: null,
          distr: null,
          numTrees: null,
          plantStart: null
        }
      ] as SitePolygon[];

      jest.spyOn(SitePolygon, "findAll").mockResolvedValue(mockSitePolygons);

      const result = await validator.validatePolygons(["uuid-1", "uuid-2", "uuid-3"]);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        polygonUuid: "uuid-1",
        valid: true,
        extraInfo: {
          validationErrors: [],
          missingFields: []
        }
      });
      expect(result[1]).toEqual({
        polygonUuid: "uuid-2",
        valid: false,
        extraInfo: {
          validationErrors: expect.arrayContaining([
            expect.objectContaining({ field: "polyName", exists: false }),
            expect.objectContaining({ field: "practice", exists: false }),
            expect.objectContaining({ field: "targetSys", exists: false }),
            expect.objectContaining({ field: "distr", exists: false }),
            expect.objectContaining({ field: "numTrees", exists: false }),
            expect.objectContaining({ field: "plantStart", exists: false })
          ]),
          missingFields: expect.arrayContaining([
            "polyName",
            "practice",
            "targetSys",
            "distr",
            "numTrees",
            "plantStart"
          ])
        }
      });
      expect(result[2]).toEqual({
        polygonUuid: "uuid-3",
        valid: false,
        extraInfo: { error: "Site polygon not found" }
      });
    });

    it("should handle empty polygon list", async () => {
      jest.spyOn(SitePolygon, "findAll").mockResolvedValue([]);

      const result = await validator.validatePolygons([]);

      expect(result).toEqual([]);
    });
  });

  describe("field validation", () => {
    it("should validate all valid practices", () => {
      const validPractices = ["tree-planting", "direct-seeding", "assisted-natural-regeneration"];

      validPractices.forEach(practice => {
        const mockSitePolygon = {
          polyName: "Test",
          practice,
          targetSys: "agroforest",
          distr: "single-line",
          numTrees: 100,
          plantStart: new Date("2023-01-01")
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

        expect(validator.validatePolygon("test-uuid")).resolves.toMatchObject({
          valid: true
        });
      });
    });

    it("should validate all valid target systems", () => {
      const validSystems = [
        "agroforest",
        "grassland",
        "natural-forest",
        "mangrove",
        "peatland",
        "riparian-area-or-wetland",
        "silvopasture",
        "woodlot-or-plantation",
        "urban-forest"
      ];

      validSystems.forEach(system => {
        const mockSitePolygon = {
          polyName: "Test",
          practice: "tree-planting",
          targetSys: system,
          distr: "single-line",
          numTrees: 100,
          plantStart: new Date("2023-01-01")
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

        expect(validator.validatePolygon("test-uuid")).resolves.toMatchObject({
          valid: true
        });
      });
    });

    it("should validate all valid distributions", () => {
      const validDistributions = ["single-line", "partial", "full"];

      validDistributions.forEach(distr => {
        const mockSitePolygon = {
          polyName: "Test",
          practice: "tree-planting",
          targetSys: "agroforest",
          distr,
          numTrees: 100,
          plantStart: new Date("2023-01-01")
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

        expect(validator.validatePolygon("test-uuid")).resolves.toMatchObject({
          valid: true
        });
      });
    });
  });
});
