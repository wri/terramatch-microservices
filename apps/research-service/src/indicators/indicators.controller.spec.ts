import { populateDto } from "@terramatch-microservices/common/dto/json-api-attributes";
import { IndicatorsController } from "./indicators.controller";
import { IndicatorsSummaryDto } from "./dto/Indicators-summary.dto";
import { Test, TestingModule } from "@nestjs/testing";
import { IndicatorsService } from "./indicators.service";
import { getQueueToken } from "@nestjs/bullmq";
import { IndicatorsBodyDto } from "./dto/indicators-body.dto";
import { serialize } from "@terramatch-microservices/common/util/testing";
import { DelayedJob } from "@terramatch-microservices/database/entities";
import { IndicatorSlug } from "@terramatch-microservices/database/constants";

describe("IndicatorsController", () => {
  let controller: IndicatorsController;

  const sampleIndicatorsSummary = new IndicatorsSummaryDto();
  populateDto(sampleIndicatorsSummary, {
    polygonUuids: ["123e4567-e89b-12d3-a456-426614174000", "123e4567-e89b-12d3-a456-426614174001"],
    totalPolygons: 2
  });

  const mockValidationService = {};

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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [IndicatorsController],
      providers: [
        {
          provide: IndicatorsService,
          useValue: mockValidationService
        },
        {
          provide: getQueueToken("indicators"),
          useValue: mockQueue
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
        ...request.data.attributes,
        delayedJobId: 1
      });
      expect(result.data).toBeDefined();
    });
  });
});
