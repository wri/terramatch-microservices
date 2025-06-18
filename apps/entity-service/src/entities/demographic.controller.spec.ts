import { Demographic, Project } from "@terramatch-microservices/database/entities";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectPitchQueryDto } from "./dto/project-pitch-query.dto";
import { DemographicsController } from "./demographics.controller";
import { DemographicService } from "./demographic.service";
import { DemographicQueryDto } from "./dto/demographic-query.dto";
import { ProjectFactory } from "@terramatch-microservices/database/factories";

describe("DemographicsController", () => {
  let controller: DemographicsController;
  let demographicService: DeepMocked<DemographicService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DemographicsController],
      providers: [
        { provide: DemographicService, useValue: (demographicService = createMock<DemographicService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(DemographicsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Demographics Index", () => {
    it("should return demographics successfully", async () => {
      const mockResponse = {
        data: [],
        paginationTotal: 0,
        pageNumber: 1
      };
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);

      demographicService.getDemographics.mockResolvedValue(mockResponse);

      const result = await controller.demographicsIndex(new DemographicQueryDto());
      expect(demographicService.getDemographics).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it("should return an array of 3 demographics successfully", async () => {
      const project = await ProjectFactory.create();
      const mockResponse = {
        data: [
          new Demographic({
            uuid: "1",
            type: "type 1",
            demographicalType: Project.LARAVEL_TYPE,
            demographicalId: project.id
          } as Demographic),
          new Demographic({
            uuid: "2",
            type: "type 2",
            demographicalType: Project.LARAVEL_TYPE,
            demographicalId: project.id
          } as Demographic)
        ],
        paginationTotal: 3,
        pageNumber: 1
      };
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);
      demographicService.getDemographics.mockResolvedValue(mockResponse);

      const result = await controller.demographicsIndex(new DemographicQueryDto());
      expect(result).toBeDefined();
      expect(Array.isArray(result.data) ? result.data.length : 0).toBe(2);
      expect(demographicService.getDemographics).toHaveBeenCalledTimes(1);
    });

    it("should throw BadRequestException for invalid parameters", async () => {
      demographicService.getDemographics.mockRejectedValue(new BadRequestException("Invalid parameters"));

      await expect(controller.demographicsIndex(new ProjectPitchQueryDto())).rejects.toThrow(BadRequestException);
    });

    it("should handle unexpected errors gracefully", async () => {
      demographicService.getDemographics.mockRejectedValue(new Error("Unexpected error"));

      await expect(controller.demographicsIndex(new ProjectPitchQueryDto())).rejects.toThrow(Error);
    });
  });
});
