import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { IndicatorsController } from "./indicators.controller";
import { IndicatorsSummaryDto } from "./dto/Indicators-summary.dto";
import { Test, TestingModule } from "@nestjs/testing";
import { IndicatorsService } from "./indicators.service";
import { getQueueToken } from "@nestjs/bullmq";
import { IndicatorsBodyDto } from "./dto/indicators-body.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { DelayedJob, SitePolygon } from "@terramatch-microservices/database/entities";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";
import { PolicyService } from "@terramatch-microservices/common";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { IndicatorTreeCoverLossDto } from "../site-polygons/dto/indicators.dto";

describe("IndicatorsController", () => {
  let controller: IndicatorsController;
  let indicatorsService: DeepMocked<IndicatorsService>;
  let policyService: DeepMocked<PolicyService>;

  const sampleIndicatorsSummary = new IndicatorsSummaryDto();
  populateDto(sampleIndicatorsSummary, {
    polygonUuids: ["123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-12d3-a456-426614174001"],
    totalPolygons: 2
  });

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

    indicatorsService = createMock<IndicatorsService>();
    policyService = createMock<PolicyService>({
      authorize: jest.fn().mockResolvedValue(undefined)
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndicatorsController],
      providers: [
        {
          provide: IndicatorsService,
          useValue: indicatorsService
        },
        {
          provide: getQueueToken("indicators"),
          useValue: mockQueue
        },
        {
          provide: PolicyService,
          useValue: policyService
        }
      ]
    }).compile();

    controller = module.get<IndicatorsController>(IndicatorsController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("startIndicatorCalculation", () => {
    const mockRequest = { authenticatedUserId: 1 };

    it("should create a indicators job", async () => {
      const request: IndicatorsBodyDto = {
        data: {
          type: "indicators",
          attributes: {
            polygonUuids: sampleIndicatorsSummary.polygonUuids,
            updateExisting: null,
            forceRecalculation: null
          }
        }
      };
      const slug: IndicatorSlug = "treeCoverLoss";
      const result = serialize(await controller.startIndicatorCalculation({ slug }, request, mockRequest));
      expect(mockQueue.add).toHaveBeenCalledWith("indicatorCalculation", {
        slug,
        ...request.data.attributes,
        delayedJobId: 1
      });
      expect(result.data).toBeDefined();
    });
  });

  describe("getIndicatorData", () => {
    const polygonUuid = "123e4567-e89b-12d3-a456-426614174000";
    const slug: IndicatorSlug = "treeCoverLoss";

    beforeEach(() => {
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue({
        id: 1,
        uuid: polygonUuid
      } as unknown as SitePolygon);
    });

    it("should return indicator data for a valid site polygon", async () => {
      const mockIndicator = new IndicatorTreeCoverLossDto();
      populateDto(mockIndicator, {
        indicatorSlug: "treeCoverLoss",
        yearOfAnalysis: 2024,
        value: { "2024": 0.5, "2023": 0.4 }
      });

      indicatorsService.getIndicatorData.mockResolvedValue([mockIndicator]);

      const params = {
        entity: "sitePolygon" as const,
        uuid: polygonUuid,
        slug
      };

      const result = serialize(await controller.getIndicatorData(params));

      expect(policyService.authorize).toHaveBeenCalled();
      expect(indicatorsService.getIndicatorData).toHaveBeenCalledWith(polygonUuid, slug);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.meta?.indices?.[0].total).toBe(1);
    });

    it("should throw NotFoundException when entity type is not sitePolygon", async () => {
      const params = {
        entity: "invalidEntity" as "sitePolygon",
        uuid: polygonUuid,
        slug
      };

      await expect(controller.getIndicatorData(params)).rejects.toThrow(NotFoundException);
      expect(indicatorsService.getIndicatorData).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when site polygon is not found", async () => {
      jest.spyOn(SitePolygon, "findOne").mockResolvedValue(null);

      const params = {
        entity: "sitePolygon" as const,
        uuid: polygonUuid,
        slug
      };

      await expect(controller.getIndicatorData(params)).rejects.toThrow(NotFoundException);
      expect(indicatorsService.getIndicatorData).not.toHaveBeenCalled();
    });

    it("should throw NotFoundException when no indicator data is found", async () => {
      indicatorsService.getIndicatorData.mockResolvedValue([]);

      const params = {
        entity: "sitePolygon" as const,
        uuid: polygonUuid,
        slug
      };

      await expect(controller.getIndicatorData(params)).rejects.toThrow(NotFoundException);
      expect(indicatorsService.getIndicatorData).toHaveBeenCalledWith(polygonUuid, slug);
    });

    it("should throw NotFoundException when indicator slug is unknown", async () => {
      const mockIndicator = new IndicatorTreeCoverLossDto();
      populateDto(mockIndicator, {
        indicatorSlug: "treeCoverLoss",
        yearOfAnalysis: 2024,
        value: { "2024": 0.5 }
      });

      indicatorsService.getIndicatorData.mockResolvedValue([mockIndicator]);

      const params = {
        entity: "sitePolygon" as const,
        uuid: polygonUuid,
        slug: "unknownSlug" as IndicatorSlug
      };

      await expect(controller.getIndicatorData(params)).rejects.toThrow(NotFoundException);
    });
  });
});
