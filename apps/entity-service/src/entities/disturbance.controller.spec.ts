import { Disturbance, SiteReport } from "@terramatch-microservices/database/entities";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectPitchQueryDto } from "./dto/project-pitch-query.dto";
import { SiteReportFactory } from "@terramatch-microservices/database/factories";
import { DisturbancesController } from "./disturbances.controller";
import { DisturbanceService } from "./disturbance.service";
import { DisturbanceQueryDto } from "./dto/disturbance-query.dto";

describe("DisturbanceController", () => {
  let controller: DisturbancesController;
  let disturbanceService: DeepMocked<DisturbanceService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DisturbancesController],
      providers: [
        { provide: DisturbanceService, useValue: (disturbanceService = createMock<DisturbanceService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(DisturbancesController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Disturbance Index", () => {
    it("should return disturbances successfully", async () => {
      const mockResponse = {
        data: [],
        paginationTotal: 0,
        pageNumber: 1
      };
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);

      disturbanceService.getDisturbances.mockResolvedValue(mockResponse);

      const result = await controller.disturbancesIndex(new DisturbanceQueryDto());
      expect(disturbanceService.getDisturbances).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it("should return an array of 3 disturbance successfully", async () => {
      const siteReport = await SiteReportFactory.create();
      const mockResponse = {
        data: [
          new Disturbance({
            uuid: "1",
            type: "type 1",
            disturbanceableType: SiteReport.LARAVEL_TYPE,
            disturbanceableId: siteReport.id
          } as Disturbance),
          new Disturbance({
            uuid: "2",
            type: "type 2",
            disturbanceableType: SiteReport.LARAVEL_TYPE,
            disturbanceableId: siteReport.id
          } as Disturbance)
        ],
        paginationTotal: 3,
        pageNumber: 1
      };
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);
      disturbanceService.getDisturbances.mockResolvedValue(mockResponse);

      const result = await controller.disturbancesIndex(new DisturbanceQueryDto());
      expect(result).toBeDefined();
      expect(Array.isArray(result.data) ? result.data.length : 0).toBe(2);
      expect(disturbanceService.getDisturbances).toHaveBeenCalledTimes(1);
    });

    it("should throw BadRequestException for invalid parameters", async () => {
      disturbanceService.getDisturbances.mockRejectedValue(new BadRequestException("Invalid parameters"));

      await expect(controller.disturbancesIndex(new ProjectPitchQueryDto())).rejects.toThrow(BadRequestException);
    });

    it("should handle unexpected errors gracefully", async () => {
      disturbanceService.getDisturbances.mockRejectedValue(new Error("Unexpected error"));

      await expect(controller.disturbancesIndex(new ProjectPitchQueryDto())).rejects.toThrow(Error);
    });
  });
});
