import { Test, TestingModule } from "@nestjs/testing";
import { DuplicateGeometryValidator } from "./duplicate-geometry.validator";
import { PointGeometry, PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Feature } from "@terramatch-microservices/database/constants";

interface MockTransaction {
  commit: jest.Mock;
  rollback: jest.Mock;
}

interface MockSequelize {
  query: jest.Mock;
  transaction: jest.Mock;
}

interface MockSitePolygon {
  polygonUuid: string;
  siteUuid: string;
  site: MockSite | null;
}

interface MockSite {
  projectId: number | null;
}

interface MockDuplicateInfo {
  poly_uuid: string;
  poly_name: string;
  site_name: string;
}

interface MockDuplicateCheckResult {
  index: number;
  existing_uuid: string;
}

const mockFeatures: Feature[] = [
  {
    geometry: {
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
    },
    properties: {}
  }
];

jest.mock("@terramatch-microservices/database/entities", () => ({
  PolygonGeometry: {
    sql: null,
    findAll: jest.fn(),
    findOne: jest.fn()
  },
  SitePolygon: {
    findOne: jest.fn(),
    findAll: jest.fn()
  },
  Site: {
    findAll: jest.fn()
  },
  PointGeometry: {
    sql: null
  }
}));

describe("DuplicateGeometryValidator", () => {
  let validator: DuplicateGeometryValidator;
  let mockSequelize: MockSequelize;
  let mockTransaction: MockTransaction;

  const getMockSequelize = () => {
    if (mockSequelize == null) {
      mockSequelize = {
        query: jest.fn(),
        transaction: jest.fn().mockResolvedValue(mockTransaction)
      };
    }
    return mockSequelize;
  };

  beforeEach(async () => {
    mockTransaction = {
      commit: jest.fn(),
      rollback: jest.fn()
    };

    mockSequelize = getMockSequelize();
    (PolygonGeometry.sql as unknown as MockSequelize) = mockSequelize;

    const module: TestingModule = await Test.createTestingModule({
      providers: [DuplicateGeometryValidator]
    }).compile();

    validator = module.get<DuplicateGeometryValidator>(DuplicateGeometryValidator);
  });

  afterEach(() => {
    jest.clearAllMocks();
    const sequelize = getMockSequelize();
    sequelize.query.mockClear();
    sequelize.transaction.mockClear();
    (PolygonGeometry.sql as unknown as MockSequelize) = sequelize;
  });

  describe("validatePolygon", () => {
    it("should return valid=true when no duplicates found", async () => {
      const polygonUuid = "test-uuid-1";
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-1",
        site: { projectId: 1 }
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([]);
      mockSequelize.query.mockResolvedValue([]);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: true,
        extraInfo: null
      });
    });

    it("should return valid=false when duplicates found", async () => {
      const polygonUuid = "test-uuid-1";
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid-1",
        site: { projectId: 1 }
      };

      const mockBboxResults = [{ candidateUuid: "related-uuid-1" }];
      const mockDuplicateResults = [
        {
          candidateUuid: "related-uuid-1",
          polyName: "Duplicate Polygon 1",
          siteName: "Site 1"
        }
      ];

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([
        { polygonUuid: "related-uuid-1" },
        { polygonUuid: "related-uuid-2" }
      ]);
      mockSequelize.query.mockResolvedValueOnce(mockBboxResults).mockResolvedValueOnce(mockDuplicateResults);

      const result = await validator.validatePolygon(polygonUuid);

      expect(result).toEqual({
        valid: false,
        extraInfo: [
          {
            poly_uuid: "related-uuid-1",
            poly_name: "Duplicate Polygon 1",
            site_name: "Site 1"
          }
        ]
      });
    });

    it("should throw NotFoundException when site polygon not found", async () => {
      const polygonUuid = "non-existent-uuid";
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(null);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(
        new NotFoundException(`Site polygon with UUID ${polygonUuid} not found or has no associated project`)
      );
    });

    it("should throw NotFoundException when site is null", async () => {
      const polygonUuid = "test-uuid";
      const mockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid",
        site: null
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow(
        new NotFoundException(`Site polygon with UUID ${polygonUuid} not found or has no associated project`)
      );
    });

    it("should handle database query errors", async () => {
      const polygonUuid = "test-uuid";
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid,
        siteUuid: "site-uuid",
        site: { projectId: 1 }
      };

      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      mockSequelize.transaction.mockResolvedValue(mockTransaction);
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([{ polygonUuid: "related-uuid" }]);
      mockSequelize.query.mockRejectedValue(new Error("Database error"));

      await expect(validator.validatePolygon(polygonUuid)).rejects.toThrow("Database error");
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe("validatePolygons", () => {
    it("should return empty array for empty input", async () => {
      const result = await validator.validatePolygons([]);
      expect(result).toEqual([]);
    });

    it("should throw BadRequestException for duplicate UUIDs", async () => {
      const polygonUuids = ["uuid-1", "uuid-2", "uuid-1"];

      await expect(validator.validatePolygons(polygonUuids)).rejects.toThrow(
        new BadRequestException("DuplicateGeometryValidator received 1 duplicate polygon UUIDs")
      );
    });

    it("should validate multiple polygons successfully", async () => {
      const polygonUuids = ["uuid-1", "uuid-2"];
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid: "uuid-1",
        siteUuid: "site-uuid",
        site: { projectId: 1 }
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([]);
      mockSequelize.query.mockResolvedValue([]);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        polygonUuid: "uuid-1",
        valid: true,
        extraInfo: null
      });
      expect(result[1]).toEqual({
        polygonUuid: "uuid-2",
        valid: true,
        extraInfo: null
      });
    });

    it("should handle validation errors gracefully", async () => {
      const polygonUuids = ["uuid-1"];
      const validationError = new Error("Validation failed");

      (SitePolygon.findOne as jest.Mock).mockRejectedValue(validationError);

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        polygonUuid: "uuid-1",
        valid: false,
        extraInfo: { error: "Validation failed" }
      });
    });

    it("should handle non-Error exceptions", async () => {
      const polygonUuids = ["uuid-1"];

      (SitePolygon.findOne as jest.Mock).mockRejectedValue("String error");

      const result = await validator.validatePolygons(polygonUuids);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        polygonUuid: "uuid-1",
        valid: false,
        extraInfo: { error: "Unknown error" }
      });
    });
  });

  describe("checkNewFeaturesDuplicates", () => {
    const mockFeatures: Feature[] = [
      {
        geometry: {
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
        },
        properties: {}
      }
    ];

    it("should return valid=true for empty features array", async () => {
      const result = await validator.checkNewFeaturesDuplicates([], "site-uuid");
      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should return valid=true for null features", async () => {
      const result = await validator.checkNewFeaturesDuplicates(null as unknown as Feature[], "site-uuid");
      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should return valid=true when site polygon not found", async () => {
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(null);

      const result = await validator.checkNewFeaturesDuplicates(mockFeatures, "site-uuid");
      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should return valid=true when site is null", async () => {
      const mockSitePolygon = {
        siteUuid: "site-uuid",
        site: null
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);

      const result = await validator.checkNewFeaturesDuplicates(mockFeatures, "site-uuid");
      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should return valid=true when no existing polygons", async () => {
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid: "polygon-uuid",
        siteUuid: "site-uuid",
        site: { projectId: 1 }
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([]);

      const result = await validator.checkNewFeaturesDuplicates(mockFeatures, "site-uuid");
      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should handle Polygon geometry type", async () => {
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid: "polygon-uuid",
        siteUuid: "site-uuid",
        site: { projectId: 1 }
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([{ polygonUuid: "existing-uuid" }]);
      mockSequelize.query.mockResolvedValue([]);

      const result = await validator.checkNewFeaturesDuplicates(mockFeatures, "site-uuid");
      expect(result).toEqual({ valid: true, duplicates: [] });
    });
  });

  describe("getProjectPolygonUuids", () => {
    it("should return polygon UUIDs for project", async () => {
      const projectId = 1;
      const mockSitePolygons = [{ polygonUuid: "uuid-1" }, { polygonUuid: "uuid-2" }, { polygonUuid: null }];

      (SitePolygon.findAll as jest.Mock).mockResolvedValue(mockSitePolygons);

      const result = await (
        validator as unknown as {
          getProjectPolygonUuids: (projectId: number, excludeUuid?: string) => Promise<string[]>;
        }
      ).getProjectPolygonUuids(projectId);

      expect(result).toEqual(["uuid-1", "uuid-2"]);
    });

    it("should exclude specified UUID", async () => {
      const projectId = 1;
      const excludeUuid = "uuid-1";
      const mockSitePolygons = [{ polygonUuid: "uuid-1" }, { polygonUuid: "uuid-2" }];

      (SitePolygon.findAll as jest.Mock).mockResolvedValue(mockSitePolygons);

      const result = await (
        validator as unknown as {
          getProjectPolygonUuids: (projectId: number, excludeUuid?: string) => Promise<string[]>;
        }
      ).getProjectPolygonUuids(projectId, excludeUuid);

      expect(result).toEqual(["uuid-2"]);
    });
  });

  describe("checkGeometryDuplicates", () => {
    it("should return empty array when no candidates", async () => {
      const result = await (
        validator as unknown as {
          checkGeometryDuplicates: (targetUuid: string, candidateUuids: string[]) => Promise<MockDuplicateInfo[]>;
        }
      ).checkGeometryDuplicates("target-uuid", []);

      expect(result).toEqual([]);
    });

    it("should return empty array when no bbox intersections", async () => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      mockSequelize.transaction.mockResolvedValue(mockTransaction);
      mockSequelize.query.mockResolvedValue([]);

      const result = await (
        validator as unknown as {
          checkGeometryDuplicates: (targetUuid: string, candidateUuids: string[]) => Promise<MockDuplicateInfo[]>;
        }
      ).checkGeometryDuplicates("target-uuid", ["candidate-uuid"]);

      expect(result).toEqual([]);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should return duplicates when found", async () => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const mockBboxResults = [{ candidateUuid: "duplicate-uuid" }];
      const mockDuplicateResults = [
        {
          candidateUuid: "duplicate-uuid",
          polyName: "Duplicate Polygon",
          siteName: "Site Name"
        }
      ];

      mockSequelize.transaction.mockResolvedValue(mockTransaction);
      mockSequelize.query.mockResolvedValueOnce(mockBboxResults).mockResolvedValueOnce(mockDuplicateResults);

      const result = await (
        validator as unknown as {
          checkGeometryDuplicates: (targetUuid: string, candidateUuids: string[]) => Promise<MockDuplicateInfo[]>;
        }
      ).checkGeometryDuplicates("target-uuid", ["candidate-uuid"]);

      expect(result).toEqual([
        {
          poly_uuid: "duplicate-uuid",
          poly_name: "Duplicate Polygon",
          site_name: "Site Name"
        }
      ]);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it("should handle null values in results", async () => {
      const mockDuplicates = [
        {
          candidateUuid: "duplicate-uuid",
          polyName: null,
          siteName: null
        }
      ];

      mockSequelize.query
        .mockResolvedValueOnce([{ candidateUuid: "duplicate-uuid" }])
        .mockResolvedValueOnce(mockDuplicates);

      const result = await (
        validator as unknown as {
          checkGeometryDuplicates: (targetUuid: string, candidateUuids: string[]) => Promise<MockDuplicateInfo[]>;
        }
      ).checkGeometryDuplicates("target-uuid", ["candidate-uuid"]);

      expect(result).toEqual([
        {
          poly_uuid: "duplicate-uuid",
          poly_name: "",
          site_name: ""
        }
      ]);
    });

    it("should handle database errors", async () => {
      const mockTransaction = {
        commit: jest.fn(),
        rollback: jest.fn()
      };

      const dbError = new Error("Database connection failed");
      mockSequelize.transaction.mockResolvedValue(mockTransaction);
      mockSequelize.query.mockRejectedValue(dbError);

      await expect(
        (
          validator as unknown as {
            checkGeometryDuplicates: (targetUuid: string, candidateUuids: string[]) => Promise<MockDuplicateInfo[]>;
          }
        ).checkGeometryDuplicates("target-uuid", ["candidate-uuid"])
      ).rejects.toThrow(dbError);

      expect(mockTransaction.rollback).toHaveBeenCalled();
    });
  });

  describe("checkNewPolygonsDuplicates", () => {
    it("should return valid=true for empty features", async () => {
      const result = await (
        validator as unknown as {
          checkNewPolygonsDuplicates: (
            features: Feature[],
            existingPolygonUuids: string[]
          ) => Promise<{ valid: boolean; duplicates: MockDuplicateCheckResult[] }>;
        }
      ).checkNewPolygonsDuplicates([], ["existing-uuid"]);

      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should return valid=true for empty existing polygons", async () => {
      const result = await (
        validator as unknown as {
          checkNewPolygonsDuplicates: (
            features: Feature[],
            existingPolygonUuids: string[]
          ) => Promise<{ valid: boolean; duplicates: MockDuplicateCheckResult[] }>;
        }
      ).checkNewPolygonsDuplicates(mockFeatures, []);

      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should return valid=true when no geometry in features", async () => {
      const featuresWithoutGeometry: Feature[] = [
        {
          geometry: null as unknown as { type: "Polygon"; coordinates: number[][][] },
          properties: {}
        }
      ];

      const result = await (
        validator as unknown as {
          checkNewPolygonsDuplicates: (
            features: Feature[],
            existingPolygonUuids: string[]
          ) => Promise<{ valid: boolean; duplicates: MockDuplicateCheckResult[] }>;
        }
      ).checkNewPolygonsDuplicates(featuresWithoutGeometry, ["existing-uuid"]);

      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should return valid=true when no duplicates found", async () => {
      mockSequelize.query.mockResolvedValue([]);

      const result = await (
        validator as unknown as {
          checkNewPolygonsDuplicates: (
            features: Feature[],
            existingPolygonUuids: string[]
          ) => Promise<{ valid: boolean; duplicates: MockDuplicateCheckResult[] }>;
        }
      ).checkNewPolygonsDuplicates(mockFeatures, ["existing-uuid"]);

      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should return valid=false when duplicates found", async () => {
      const mockDuplicates = [{ idx: 0, existing_uuid: "existing-uuid-1" }];

      mockSequelize.query.mockResolvedValue(mockDuplicates);

      const result = await (
        validator as unknown as {
          checkNewPolygonsDuplicates: (
            features: Feature[],
            existingPolygonUuids: string[]
          ) => Promise<{ valid: boolean; duplicates: MockDuplicateCheckResult[] }>;
        }
      ).checkNewPolygonsDuplicates(mockFeatures, ["existing-uuid-1"]);

      expect(result).toEqual({
        valid: false,
        duplicates: [{ index: 0, existing_uuid: "existing-uuid-1" }]
      });
    });

    it("should handle sequelize connection missing", async () => {
      (PolygonGeometry.sql as unknown as MockSequelize | null) = null;

      const result = await (
        validator as unknown as {
          checkNewPolygonsDuplicates: (
            features: Feature[],
            existingPolygonUuids: string[]
          ) => Promise<{ valid: boolean; duplicates: MockDuplicateCheckResult[] }>;
        }
      ).checkNewPolygonsDuplicates(mockFeatures, ["existing-uuid"]);

      expect(result).toEqual({ valid: true, duplicates: [] });
    });

    it("should handle database errors gracefully", async () => {
      mockSequelize.query.mockRejectedValue(new Error("Database error"));

      const result = await (
        validator as unknown as {
          checkNewPolygonsDuplicates: (
            features: Feature[],
            existingPolygonUuids: string[]
          ) => Promise<{ valid: boolean; duplicates: MockDuplicateCheckResult[] }>;
        }
      ).checkNewPolygonsDuplicates(mockFeatures, ["existing-uuid"]);

      expect(result).toEqual({ valid: true, duplicates: [] });
    });
  });

  describe("checkNewPointsDuplicates", () => {
    const mockPointFeatures: Feature[] = [
      {
        geometry: {
          type: "Point",
          coordinates: [0, 0]
        },
        properties: {}
      }
    ];

    it("should return empty map for empty features array", async () => {
      const result = await validator.checkNewPointsDuplicates([], "site-uuid");
      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return empty map for null features", async () => {
      const result = await validator.checkNewPointsDuplicates(null as unknown as Feature[], "site-uuid");
      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return empty map when site polygon not found", async () => {
      (SitePolygon.findOne as jest.Mock).mockResolvedValue(null);

      const result = await validator.checkNewPointsDuplicates(mockPointFeatures, "site-uuid");
      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return empty map when site is null", async () => {
      const mockSitePolygon = {
        siteUuid: "site-uuid",
        site: null
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);

      const result = await validator.checkNewPointsDuplicates(mockPointFeatures, "site-uuid");
      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return empty map when no existing points", async () => {
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid: "polygon-uuid",
        siteUuid: "site-uuid",
        site: { projectId: 1 }
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([]);

      const result = await validator.checkNewPointsDuplicates(mockPointFeatures, "site-uuid");
      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return empty map when no Point geometry in features", async () => {
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid: "polygon-uuid",
        siteUuid: "site-uuid",
        site: { projectId: 1 }
      };

      const nonPointFeatures: Feature[] = [
        {
          geometry: {
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
          },
          properties: {}
        }
      ];

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([{ pointUuid: "existing-point-uuid" }]);

      const result = await validator.checkNewPointsDuplicates(nonPointFeatures, "site-uuid");
      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return duplicates when found", async () => {
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid: "polygon-uuid",
        siteUuid: "site-uuid",
        site: { projectId: 1 }
      };

      const mockDuplicateResults = [{ idx: 0, existing_uuid: "existing-point-uuid" }];

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([{ pointUuid: "existing-point-uuid" }]);

      (PointGeometry.sql as unknown as MockSequelize) = {
        query: jest.fn().mockResolvedValue(mockDuplicateResults),
        transaction: jest.fn()
      };

      const result = await validator.checkNewPointsDuplicates(mockPointFeatures, "site-uuid");

      expect(result.duplicateIndexToUuid).toBeInstanceOf(Map);
      expect(result.duplicateIndexToUuid.size).toBe(1);
      expect(result.duplicateIndexToUuid.get(0)).toBe("existing-point-uuid");
    });

    it("should handle sequelize connection missing gracefully", async () => {
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid: "polygon-uuid",
        siteUuid: "site-uuid",
        site: { projectId: 1 }
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([{ pointUuid: "existing-point-uuid" }]);
      (PointGeometry.sql as unknown as MockSequelize | null) = null;

      const result = await validator.checkNewPointsDuplicates(mockPointFeatures, "site-uuid");
      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should handle database errors gracefully", async () => {
      const mockSitePolygon: MockSitePolygon = {
        polygonUuid: "polygon-uuid",
        siteUuid: "site-uuid",
        site: { projectId: 1 }
      };

      (SitePolygon.findOne as jest.Mock).mockResolvedValue(mockSitePolygon);
      (SitePolygon.findAll as jest.Mock).mockResolvedValue([{ pointUuid: "existing-point-uuid" }]);

      (PointGeometry.sql as unknown as MockSequelize) = {
        query: jest.fn().mockRejectedValue(new Error("Database error")),
        transaction: jest.fn()
      };

      const result = await validator.checkNewPointsDuplicates(mockPointFeatures, "site-uuid");
      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });
  });

  describe("getProjectPointUuids", () => {
    it("should return point UUIDs for project", async () => {
      const projectId = 1;
      const mockSitePolygons = [{ pointUuid: "point-uuid-1" }, { pointUuid: "point-uuid-2" }, { pointUuid: null }];

      (SitePolygon.findAll as jest.Mock).mockResolvedValue(mockSitePolygons);

      const result = await (
        validator as unknown as {
          getProjectPointUuids: (projectId: number) => Promise<string[]>;
        }
      ).getProjectPointUuids(projectId);

      expect(result).toEqual(["point-uuid-1", "point-uuid-2"]);
    });

    it("should return empty array when no point UUIDs", async () => {
      const projectId = 1;
      const mockSitePolygons = [{ pointUuid: null }, { pointUuid: null }];

      (SitePolygon.findAll as jest.Mock).mockResolvedValue(mockSitePolygons);

      const result = await (
        validator as unknown as {
          getProjectPointUuids: (projectId: number) => Promise<string[]>;
        }
      ).getProjectPointUuids(projectId);

      expect(result).toEqual([]);
    });
  });

  describe("checkNewPointsDuplicatesInternal", () => {
    const mockPointFeatures: Feature[] = [
      {
        geometry: {
          type: "Point",
          coordinates: [0, 0]
        },
        properties: {}
      },
      {
        geometry: {
          type: "Point",
          coordinates: [1, 1]
        },
        properties: {}
      }
    ];

    it("should return empty map for empty features", async () => {
      const result = await (
        validator as unknown as {
          checkNewPointsDuplicatesInternal: (
            pointFeatures: Feature[],
            existingPointUuids: string[]
          ) => Promise<{ duplicateIndexToUuid: Map<number, string> }>;
        }
      ).checkNewPointsDuplicatesInternal([], ["existing-uuid"]);

      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return empty map for empty existing points", async () => {
      const result = await (
        validator as unknown as {
          checkNewPointsDuplicatesInternal: (
            pointFeatures: Feature[],
            existingPointUuids: string[]
          ) => Promise<{ duplicateIndexToUuid: Map<number, string> }>;
        }
      ).checkNewPointsDuplicatesInternal(mockPointFeatures, []);

      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return empty map when no Point geometry in features", async () => {
      const nonPointFeatures: Feature[] = [
        {
          geometry: {
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
          },
          properties: {}
        }
      ];

      const result = await (
        validator as unknown as {
          checkNewPointsDuplicatesInternal: (
            pointFeatures: Feature[],
            existingPointUuids: string[]
          ) => Promise<{ duplicateIndexToUuid: Map<number, string> }>;
        }
      ).checkNewPointsDuplicatesInternal(nonPointFeatures, ["existing-uuid"]);

      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return empty map when no geometry in features", async () => {
      const featuresWithoutGeometry: Feature[] = [
        {
          geometry: null as unknown as { type: "Point"; coordinates: number[] },
          properties: {}
        }
      ];

      const result = await (
        validator as unknown as {
          checkNewPointsDuplicatesInternal: (
            pointFeatures: Feature[],
            existingPointUuids: string[]
          ) => Promise<{ duplicateIndexToUuid: Map<number, string> }>;
        }
      ).checkNewPointsDuplicatesInternal(featuresWithoutGeometry, ["existing-uuid"]);

      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should return duplicates when found", async () => {
      const mockDuplicateResults = [
        { idx: 0, existing_uuid: "existing-point-uuid-1" },
        { idx: 1, existing_uuid: "existing-point-uuid-2" }
      ];

      (PointGeometry.sql as unknown as MockSequelize) = {
        query: jest.fn().mockResolvedValue(mockDuplicateResults),
        transaction: jest.fn()
      };

      const result = await (
        validator as unknown as {
          checkNewPointsDuplicatesInternal: (
            pointFeatures: Feature[],
            existingPointUuids: string[]
          ) => Promise<{ duplicateIndexToUuid: Map<number, string> }>;
        }
      ).checkNewPointsDuplicatesInternal(mockPointFeatures, ["existing-point-uuid-1", "existing-point-uuid-2"]);

      expect(result.duplicateIndexToUuid).toBeInstanceOf(Map);
      expect(result.duplicateIndexToUuid.size).toBe(2);
      expect(result.duplicateIndexToUuid.get(0)).toBe("existing-point-uuid-1");
      expect(result.duplicateIndexToUuid.get(1)).toBe("existing-point-uuid-2");
    });

    it("should handle sequelize connection missing gracefully", async () => {
      (PointGeometry.sql as unknown as MockSequelize | null) = null;

      const result = await (
        validator as unknown as {
          checkNewPointsDuplicatesInternal: (
            pointFeatures: Feature[],
            existingPointUuids: string[]
          ) => Promise<{ duplicateIndexToUuid: Map<number, string> }>;
        }
      ).checkNewPointsDuplicatesInternal(mockPointFeatures, ["existing-uuid"]);

      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });

    it("should handle database errors gracefully", async () => {
      (PointGeometry.sql as unknown as MockSequelize) = {
        query: jest.fn().mockRejectedValue(new Error("Database error")),
        transaction: jest.fn()
      };

      const result = await (
        validator as unknown as {
          checkNewPointsDuplicatesInternal: (
            pointFeatures: Feature[],
            existingPointUuids: string[]
          ) => Promise<{ duplicateIndexToUuid: Map<number, string> }>;
        }
      ).checkNewPointsDuplicatesInternal(mockPointFeatures, ["existing-uuid"]);

      expect(result).toEqual({ duplicateIndexToUuid: new Map() });
    });
  });
});
