import { Test, TestingModule } from "@nestjs/testing";
import { ValidationService } from "./validation.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CriteriaSite, PolygonGeometry, SitePolygon } from "@terramatch-microservices/database/entities";

jest.mock("@terramatch-microservices/database/entities", () => ({
  PolygonGeometry: {
    findOne: jest.fn()
  },
  CriteriaSite: {
    findAll: jest.fn()
  },
  SitePolygon: {
    findAndCountAll: jest.fn()
  }
}));

describe("ValidationService", () => {
  let service: ValidationService;

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
    const mockPolygons = {
      count: 2,
      rows: [{ polygonUuid: polygonUuid1 }, { polygonUuid: polygonUuid2 }]
    };

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
      (SitePolygon.findAndCountAll as jest.Mock).mockResolvedValue(mockPolygons);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue(mockCriteria);

      const result = await service.getSiteValidations(siteUuid);

      expect(SitePolygon.findAndCountAll).toHaveBeenCalledWith({
        where: {
          siteUuid,
          isActive: true
        },
        attributes: ["polygonUuid"],
        limit: 100,
        offset: 0
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
      const pageSize = 100; // Use MAX_PAGE_SIZE to avoid type issues
      const pageNumber = 2;

      (SitePolygon.findAndCountAll as jest.Mock).mockResolvedValue(mockPolygons);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue(mockCriteria);

      await service.getSiteValidations(siteUuid, pageSize, pageNumber);

      expect(SitePolygon.findAndCountAll).toHaveBeenCalledWith({
        where: {
          siteUuid,
          isActive: true
        },
        attributes: ["polygonUuid"],
        limit: pageSize,
        offset: (pageNumber - 1) * pageSize
      });
    });

    it("should throw BadRequestException when page size is invalid", async () => {
      // Cast to any to bypass TypeScript constraint for testing the runtime check
      await expect(service.getSiteValidations(siteUuid, 101 as any, 1)).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when page number is invalid", async () => {
      const invalidPageNumber = 0; // Below minimum page number

      await expect(service.getSiteValidations(siteUuid, 100, invalidPageNumber)).rejects.toThrow(BadRequestException);
    });

    it("should throw NotFoundException when site has no polygons", async () => {
      (SitePolygon.findAndCountAll as jest.Mock).mockResolvedValue({
        count: 0,
        rows: []
      });

      await expect(service.getSiteValidations(siteUuid)).rejects.toThrow(NotFoundException);

      expect(SitePolygon.findAndCountAll).toHaveBeenCalled();
      expect(CriteriaSite.findAll).not.toHaveBeenCalled();
    });

    it("should handle site polygons with missing validation criteria", async () => {
      (SitePolygon.findAndCountAll as jest.Mock).mockResolvedValue(mockPolygons);
      (CriteriaSite.findAll as jest.Mock).mockResolvedValue([mockCriteria[0]]); // Only return criteria for first polygon

      const result = await service.getSiteValidations(siteUuid);

      expect(result.validations).toHaveLength(2);
      expect(result.validations[0].criteriaList).toHaveLength(1);
      expect(result.validations[1].criteriaList).toHaveLength(0); // Second polygon has no criteria
    });
  });
});
