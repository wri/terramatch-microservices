import { Test } from "@nestjs/testing";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { Resource } from "@terramatch-microservices/common/util";
import { TotalSectionHeaderController } from "../total-section-header.controller";
import { TotalSectionHeaderService } from "./total-section-header.service";
import { TotalSectionHeaderDto } from "./total-section-header.dto";
import { DashboardQueryDto } from "./dashboard-query.dto";

describe("TotalSectionHeaderController", () => {
  let controller: TotalSectionHeaderController;
  let totalSectionHeaderService: DeepMocked<TotalSectionHeaderService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TotalSectionHeaderController],
      providers: [
        {
          provide: TotalSectionHeaderService,
          useValue: (totalSectionHeaderService = createMock<TotalSectionHeaderService>())
        }
      ]
    }).compile();

    controller = module.get(TotalSectionHeaderController);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  const totalSectionHeaderDto = new TotalSectionHeaderDto({
    totalNonProfitCount: 0,
    totalEnterpriseCount: 0,
    totalEntries: 0,
    totalHectaresRestored: 0,
    totalHectaresRestoredGoal: 0,
    totalTreesRestored: 0,
    totalTreesRestoredGoal: 0,
    lastUpdatedAt: ""
  });

  describe("getTotalSectionHeader", () => {
    it("should throw error when no parameters are provided", async () => {
      const query = new DashboardQueryDto();
      await expect(controller.getTotalSectionHeader(query)).rejects.toThrow("No valid filter parameters provided");
    });

    it("should return data for getTotalSectionHeader when filters are applied", async () => {
      const query = new DashboardQueryDto();
      query.country = "BJ";
      query.landscapes = ["test-landscape-1", "test-landscape-2"];
      query.cohort = "test-landscape-1";
      query.programmes = ["test-programmes-1", "test-programmes-2"];

      totalSectionHeaderService.getTotalSectionHeader.mockResolvedValue(totalSectionHeaderDto);

      const result = await controller.getTotalSectionHeader(query);

      expect(totalSectionHeaderService.getTotalSectionHeader).toHaveBeenCalledWith(query);
      expect(result).toEqual(totalSectionHeaderDto);
    });
  });
});
