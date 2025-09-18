import { Test, TestingModule } from "@nestjs/testing";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { SiteValidationQueryDto } from "./dto/site-validation-query.dto";

describe("ValidationController", () => {
  let controller: ValidationController;

  const sampleValidation = new ValidationDto();
  populateDto(sampleValidation, {
    polygonId: "7631be34-bbe0-4e1e-b4fe-592677dc4b50",
    criteriaList: [
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
      }
    ]
  });

  const siteValidation1 = new ValidationDto();
  populateDto(siteValidation1, {
    polygonId: "polygon-uuid-123",
    criteriaList: [
      {
        criteriaId: 1,
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
        criteriaId: 2,
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

    it("should throw NotFoundException when polygon is not found", async () => {
      const nonExistentUuid = "non-existent-uuid";
      mockValidationService.getPolygonValidation.mockRejectedValue(
        new NotFoundException(`Polygon with UUID ${nonExistentUuid} not found`)
      );

      await expect(controller.getPolygonValidation(nonExistentUuid)).rejects.toThrow(
        new NotFoundException(`Polygon with UUID ${nonExistentUuid} not found`)
      );

      expect(mockValidationService.getPolygonValidation).toHaveBeenCalledWith(nonExistentUuid);
    });
  });

  describe("getSiteValidation", () => {
    const siteUuid = "site-uuid-123";

    it("should return validation data for a site with default pagination", async () => {
      const query: SiteValidationQueryDto = {};

      const result = serialize(await controller.getSiteValidation(siteUuid, query));

      expect(mockValidationService.getSiteValidations).toHaveBeenCalledWith(siteUuid, 100, 1);

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

      expect(mockValidationService.getSiteValidations).toHaveBeenCalledWith(siteUuid, 10, 3);
    });

    it("should throw BadRequestException for invalid page size", async () => {
      const query: SiteValidationQueryDto = {
        page: {
          size: 101,
          number: 1
        }
      };

      await expect(controller.getSiteValidation(siteUuid, query)).rejects.toThrow(BadRequestException);
      expect(mockValidationService.getSiteValidations).not.toHaveBeenCalled();
    });

    it("should throw BadRequestException for invalid page number", async () => {
      const query: SiteValidationQueryDto = {
        page: {
          size: 10,
          number: 0
        }
      };

      await expect(controller.getSiteValidation(siteUuid, query)).rejects.toThrow(BadRequestException);
      expect(mockValidationService.getSiteValidations).not.toHaveBeenCalled();
    });

    it("should pass through NotFoundException when site has no polygons", async () => {
      mockValidationService.getSiteValidations.mockRejectedValue(
        new NotFoundException(`Site with UUID ${siteUuid} not found or has no polygons`)
      );

      await expect(controller.getSiteValidation(siteUuid, {})).rejects.toThrow(NotFoundException);
    });
  });
});
