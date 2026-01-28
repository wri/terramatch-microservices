import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { BadRequestException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectPitchQueryDto } from "./dto/project-pitch-query.dto";
import { TrackingsController } from "./trackings.controller";
import { TrackingsService } from "./trackings.service";
import { TrackingsQueryDto } from "./dto/trackings-query.dto";
import { TrackingFactory, ProjectFactory } from "@terramatch-microservices/database/factories";
import { serialize } from "@terramatch-microservices/common/util/testing";

describe("TrackingsController", () => {
  let controller: TrackingsController;
  let trackingsService: DeepMocked<TrackingsService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [TrackingsController],
      providers: [
        { provide: TrackingsService, useValue: (trackingsService = createMock<TrackingsService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(TrackingsController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Trackings Index", () => {
    it("should return trackings successfully", async () => {
      const mockResponse = {
        data: [],
        paginationTotal: 0,
        pageNumber: 1
      };
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);

      trackingsService.getTrackings.mockResolvedValue(mockResponse);

      const result = serialize(await controller.index(new TrackingsQueryDto()));
      expect(trackingsService.getTrackings).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it("should return an array of 3 trackings successfully", async () => {
      const project = await ProjectFactory.create();
      const mockResponse = {
        data: await TrackingFactory.projectAllEmployees(project).createMany(2),
        paginationTotal: 3,
        pageNumber: 1
      };
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);
      trackingsService.getTrackings.mockResolvedValue(mockResponse);

      const result = serialize(await controller.index(new TrackingsQueryDto()));
      expect(result).toBeDefined();
      expect(Array.isArray(result.data) ? result.data.length : 0).toBe(2);
      expect(trackingsService.getTrackings).toHaveBeenCalledTimes(1);
    });

    it("should throw BadRequestException for invalid parameters", async () => {
      trackingsService.getTrackings.mockRejectedValue(new BadRequestException("Invalid parameters"));

      await expect(controller.index(new ProjectPitchQueryDto())).rejects.toThrow(BadRequestException);
    });

    it("should handle unexpected errors gracefully", async () => {
      trackingsService.getTrackings.mockRejectedValue(new Error("Unexpected error"));

      await expect(controller.index(new ProjectPitchQueryDto())).rejects.toThrow(Error);
    });
  });
});
