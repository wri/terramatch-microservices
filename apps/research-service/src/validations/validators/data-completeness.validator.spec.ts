import { Test, TestingModule } from "@nestjs/testing";
import { DataCompletenessValidator } from "./data-completeness.validator";
import { SitePolygon } from "@terramatch-microservices/database/entities";
import { NotFoundException } from "@nestjs/common";
import { Point, Polygon, MultiPolygon } from "geojson";

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
        practice: ["tree-planting"],
        targetSys: "agroforest",
        distr: ["single-line"],
        numTrees: 100,
        plantStart: new Date("2023-01-01")
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
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
      expect(result.extraInfo).toHaveLength(6);
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
      expect(result.extraInfo).toHaveLength(5);
      expect(result.extraInfo).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "practice", exists: true }),
          expect.objectContaining({ field: "target_sys", exists: true }),
          expect.objectContaining({ field: "distr", exists: true }),
          expect.objectContaining({ field: "num_trees", exists: true }),
          expect.objectContaining({ field: "plantstart", exists: true })
        ])
      );
    });

    it("should handle multiple valid practices", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: ["tree-planting", "direct-seeding"],
        targetSys: "agroforest",
        distr: ["single-line"],
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
        practice: ["tree-planting"],
        targetSys: "agroforest,grassland",
        distr: ["single-line"],
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
        practice: ["tree-planting"],
        targetSys: "agroforest",
        distr: ["single-line", "partial"],
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
        practice: ["tree-planting"],
        targetSys: "agroforest",
        distr: ["single-line"],
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
      expect(result.extraInfo).toHaveLength(6);
    });

    it("should handle zero numTrees as invalid", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: ["tree-planting"],
        targetSys: "agroforest",
        distr: ["single-line"],
        numTrees: 0,
        plantStart: new Date("2023-01-01")
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toHaveLength(1);
      expect(result.extraInfo?.[0]).toEqual({
        field: "num_trees",
        error: "Invalid number of trees. Must be a valid integer and cannot be 0",
        exists: true
      });
    });

    it("should handle negative numTrees as invalid", async () => {
      const mockSitePolygon = {
        polyName: "Test Polygon",
        practice: ["tree-planting"],
        targetSys: "agroforest",
        distr: ["single-line"],
        numTrees: -1,
        plantStart: new Date("2023-01-01")
      } as unknown as SitePolygon;

      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

      const result = await validator.validatePolygon("test-uuid");

      expect(result.valid).toBe(false);
      expect(result.extraInfo).toHaveLength(1);
      expect(result.extraInfo?.[0]).toEqual({
        field: "num_trees",
        error: "Invalid number of trees. Must be a valid integer and cannot be 0",
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
          practice: ["tree-planting"],
          targetSys: "agroforest",
          distr: ["single-line"],
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
        extraInfo: null
      });
      expect(result[1].polygonUuid).toBe("uuid-2");
      expect(result[1].valid).toBe(false);
      expect(result[1].extraInfo).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "poly_name", exists: false }),
          expect.objectContaining({ field: "practice", exists: false }),
          expect.objectContaining({ field: "target_sys", exists: false }),
          expect.objectContaining({ field: "distr", exists: false }),
          expect.objectContaining({ field: "num_trees", exists: false }),
          expect.objectContaining({ field: "plantstart", exists: false })
        ])
      );
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
    it("should validate all valid practices", async () => {
      const validPractices = ["tree-planting", "direct-seeding", "assisted-natural-regeneration"];
      for (const practice of validPractices) {
        const mockSitePolygon = {
          polyName: "Test",
          practice: [practice],
          targetSys: "agroforest",
          distr: ["single-line"],
          numTrees: 100,
          plantStart: new Date("2023-01-01")
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

        expect(await validator.validatePolygon("test-uuid")).toMatchObject({
          valid: true
        });
      }
    });

    it("should validate all valid target systems", async () => {
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
      for (const system of validSystems) {
        const mockSitePolygon = {
          polyName: "Test",
          practice: ["tree-planting"],
          targetSys: system,
          distr: ["single-line"],
          numTrees: 100,
          plantStart: new Date("2023-01-01")
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

        expect(await validator.validatePolygon("test-uuid")).toMatchObject({
          valid: true
        });
      }
    });

    it("should validate all valid distributions", async () => {
      const validDistributions = ["single-line", "partial", "full"];
      for (const distr of validDistributions) {
        const mockSitePolygon = {
          polyName: "Test",
          practice: ["tree-planting"],
          targetSys: "agroforest",
          distr: [distr],
          numTrees: 100,
          plantStart: new Date("2023-01-01")
        } as unknown as SitePolygon;

        jest.spyOn(SitePolygon, "findOne").mockResolvedValue(mockSitePolygon);

        expect(await validator.validatePolygon("test-uuid")).toMatchObject({
          valid: true
        });
      }
    });
  });

  describe("validateGeometry", () => {
    it("should return valid=false when properties are missing", async () => {
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ]
      };
      const result = await validator.validateGeometry(geometry);
      expect(result.valid).toBe(false);
      expect(result.extraInfo).toEqual([
        {
          field: "properties",
          error: "Feature properties are required",
          exists: false
        }
      ]);
    });

    it("should return valid=true when all properties are valid", async () => {
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ]
      };
      const properties = {
        poly_name: "Test Polygon",
        practice: ["tree-planting"],
        target_sys: "agroforest",
        distr: ["single-line"],
        num_trees: 100,
        plantstart: "2023-01-01"
      };
      const result = await validator.validateGeometry(geometry, properties);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should return valid=false when required properties are missing", async () => {
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ]
      };
      const properties = {};
      const result = await validator.validateGeometry(geometry, properties);
      expect(result.valid).toBe(false);
      expect(result.extraInfo).toHaveLength(6);
    });

    it("should return valid=false when properties have invalid values", async () => {
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ]
      };
      const properties = {
        poly_name: "Test",
        practice: ["invalid-practice"],
        target_sys: "invalid-system",
        distr: ["invalid-distribution"],
        num_trees: -5,
        plantstart: "invalid-date"
      };
      const result = await validator.validateGeometry(geometry, properties);
      expect(result.valid).toBe(false);
      expect(result.extraInfo).toHaveLength(5);
      expect(result.extraInfo).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "practice", exists: true }),
          expect.objectContaining({ field: "target_sys", exists: true }),
          expect.objectContaining({ field: "distr", exists: true }),
          expect.objectContaining({ field: "num_trees", exists: true }),
          expect.objectContaining({ field: "plantstart", exists: true })
        ])
      );
    });

    it("should validate Point geometry with properties", async () => {
      const geometry: Point = { type: "Point", coordinates: [0, 0] };
      const properties = {
        poly_name: "Test Point",
        practice: ["tree-planting"],
        target_sys: "agroforest",
        distr: ["single-line"],
        num_trees: 100,
        plantstart: "2023-01-01"
      };
      const result = await validator.validateGeometry(geometry, properties);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should validate MultiPolygon geometry with properties", async () => {
      const geometry: MultiPolygon = {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [0, 0],
              [1, 0],
              [1, 1],
              [0, 1],
              [0, 0]
            ]
          ]
        ]
      };
      const properties = {
        poly_name: "Test MultiPolygon",
        practice: ["direct-seeding"],
        target_sys: "natural-forest",
        distr: ["full"],
        num_trees: 200,
        plantstart: "2023-06-01"
      };
      const result = await validator.validateGeometry(geometry, properties);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should handle multiple valid practices", async () => {
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ]
      };
      const properties = {
        poly_name: "Test",
        practice: ["tree-planting", "direct-seeding"],
        target_sys: "agroforest",
        distr: ["single-line"],
        num_trees: 100,
        plantstart: "2023-01-01"
      };
      const result = await validator.validateGeometry(geometry, properties);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });

    it("should handle multiple valid target systems", async () => {
      const geometry: Polygon = {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 1],
            [0, 0]
          ]
        ]
      };
      const properties = {
        poly_name: "Test",
        practice: ["tree-planting"],
        target_sys: "agroforest,grassland",
        distr: ["single-line"],
        num_trees: 100,
        plantstart: "2023-01-01"
      };
      const result = await validator.validateGeometry(geometry, properties);
      expect(result.valid).toBe(true);
      expect(result.extraInfo).toBeNull();
    });
  });
});
