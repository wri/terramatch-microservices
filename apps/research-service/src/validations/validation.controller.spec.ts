import { Test, TestingModule } from "@nestjs/testing";
import { ValidationController } from "./validation.controller";
import { ValidationService } from "./validation.service";
import { ValidationDto } from "./dto/validation.dto";
import { NotFoundException } from "@nestjs/common";
import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { serialize } from "@terramatch-microservices/common/util/testing";

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

  const mockValidationService = {
    getPolygonValidation: jest.fn().mockResolvedValue(sampleValidation)
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
});
