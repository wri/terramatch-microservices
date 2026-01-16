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

describe("IndicatorsController", () => {
  let controller: IndicatorsController;

  const sampleIndicatorsSummary = new IndicatorsSummaryDto();
  populateDto(sampleIndicatorsSummary, {
    polygonUuids: ["123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-12d3-a456-426614174001"],
    totalPolygons: 2
  });

  const mockIndicatorsService = {
    exportIndicatorToCsv: jest.fn()
  };

  const mockQueue = {
    add: jest.fn()
  };

  const mockPolicyService = {
    authorize: jest.fn()
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndicatorsController],
      providers: [
        {
          provide: IndicatorsService,
          useValue: mockIndicatorsService
        },
        {
          provide: getQueueToken("sitePolygons"),
          useValue: mockQueue
        },
        {
          provide: PolicyService,
          useValue: mockPolicyService
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
            updateExisting: false,
            forceRecalculation: false
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

  describe("exportIndicator", () => {
    it("should call authorize before exporting", async () => {
      const mockCsvContent = "Polygon Name,Size (ha)\nTest,100";
      mockPolicyService.authorize.mockResolvedValue(undefined);
      mockIndicatorsService.exportIndicatorToCsv.mockResolvedValue(mockCsvContent);

      await controller.exportIndicator("sites", "site-uuid-123", "treeCoverLoss");

      expect(mockPolicyService.authorize).toHaveBeenCalledWith("read", SitePolygon);
    });

    it("should return CSV content for tree cover loss", async () => {
      const mockCsvContent =
        "Polygon Name,Size (ha),Site Name,Status,Plant Start Date,2020,2021\nPolygon 1,100.5,Site A,approved,2020-01-01,0.5,0.3";

      mockPolicyService.authorize.mockResolvedValue(undefined);
      mockIndicatorsService.exportIndicatorToCsv.mockResolvedValue(mockCsvContent);

      const result = await controller.exportIndicator("sites", "site-uuid-123", "treeCoverLoss");

      expect(result).toBe(mockCsvContent);
      expect(mockIndicatorsService.exportIndicatorToCsv).toHaveBeenCalledWith(
        "sites",
        "site-uuid-123",
        "treeCoverLoss"
      );
    });

    it("should return CSV content for project entity type", async () => {
      const mockCsvContent =
        "Polygon Name,Size (ha),Site Name,Status,Plant Start Date,2020\nPolygon 1,100,Site A,approved,2020-01-01,0.5";

      mockPolicyService.authorize.mockResolvedValue(undefined);
      mockIndicatorsService.exportIndicatorToCsv.mockResolvedValue(mockCsvContent);

      const result = await controller.exportIndicator("projects", "project-uuid", "treeCoverLoss");

      expect(result).toBe(mockCsvContent);
      expect(mockIndicatorsService.exportIndicatorToCsv).toHaveBeenCalledWith(
        "projects",
        "project-uuid",
        "treeCoverLoss"
      );
    });

    it("should work with different indicator slugs", async () => {
      const mockCsvContent = "Polygon Name,Size (ha),Site Name,Status,Plant Start Date,Baseline,Tree Planting\n";

      mockPolicyService.authorize.mockResolvedValue(undefined);
      mockIndicatorsService.exportIndicatorToCsv.mockResolvedValue(mockCsvContent);

      await controller.exportIndicator("sites", "site-uuid", "restorationByStrategy");

      expect(mockIndicatorsService.exportIndicatorToCsv).toHaveBeenCalledWith(
        "sites",
        "site-uuid",
        "restorationByStrategy"
      );
    });
  });
});
