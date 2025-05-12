import { ProjectPitch } from "@terramatch-microservices/database/entities";
import { createMock, DeepMocked } from "@golevelup/ts-jest";
import { Test } from "@nestjs/testing";
import { ProjectPitchesController } from "./project-pitches.controller";
import { ProjectPitchService } from "./project-pitch.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectPitchQueryDto } from "./dto/project-pitch-query.dto";

describe("ProjectPitchesController", () => {
  let controller: ProjectPitchesController;
  let projectPitchService: DeepMocked<ProjectPitchService>;
  let policyService: DeepMocked<PolicyService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProjectPitchesController],
      providers: [
        { provide: ProjectPitchService, useValue: (projectPitchService = createMock<ProjectPitchService>()) },
        { provide: PolicyService, useValue: (policyService = createMock<PolicyService>()) }
      ]
    }).compile();

    controller = module.get(ProjectPitchesController);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Project Pitches Index", () => {
    it("should return project pitches successfully", async () => {
      const mockResponse = {
        data: [],
        paginationTotal: 0,
        pageNumber: 1
      };
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);

      projectPitchService.getProjectPitches.mockResolvedValue(mockResponse);

      const result = await controller.projectPitchIndex(new ProjectPitchQueryDto());
      expect(projectPitchService.getProjectPitches).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });

    it("should return an array of 3 project pitches successfully", async () => {
      const mockResponse = {
        data: [
          new ProjectPitch({ uuid: "1", projectName: "Pitch 1", totalHectares: 200 }),
          new ProjectPitch({ uuid: "2", projectName: "Pitch 2", totalHectares: 300 })
        ],
        paginationTotal: 3,
        pageNumber: 1
      };
      policyService.getPermissions.mockResolvedValue(["framework-ppc"]);
      projectPitchService.getProjectPitches.mockResolvedValue(mockResponse);

      const result = await controller.projectPitchIndex(new ProjectPitchQueryDto());
      expect(result).toBeDefined();
      expect(Array.isArray(result.data) ? result.data.length : 0).toBe(2);
      expect(projectPitchService.getProjectPitches).toHaveBeenCalledTimes(1);
    });

    it("should throw BadRequestException for invalid parameters", async () => {
      projectPitchService.getProjectPitches.mockRejectedValue(new BadRequestException("Invalid parameters"));

      await expect(controller.projectPitchIndex(new ProjectPitchQueryDto())).rejects.toThrow(BadRequestException);
    });

    it("should handle unexpected errors gracefully", async () => {
      projectPitchService.getProjectPitches.mockRejectedValue(new Error("Unexpected error"));

      await expect(controller.projectPitchIndex(new ProjectPitchQueryDto())).rejects.toThrow(Error);
    });
  });

  describe("Project Pitch UUID", () => {
    describe("Project Pitch UUID", () => {
      it("should return a project pitch successfully", async () => {
        const mockProjectPitch = new ProjectPitch({ uuid: "1", projectName: "Pitch 1", totalHectares: 200 });
        projectPitchService.getProjectPitch.mockResolvedValue(mockProjectPitch);

        const result = await controller.projectPitchGet({ uuid: "1" });
        expect(result).toBeDefined();
        expect(result.data["id"]).toBe("1");
        expect(projectPitchService.getProjectPitch).toHaveBeenCalledWith("1");
      });

      it("should throw NotFoundException if project pitch is not found", async () => {
        projectPitchService.getProjectPitch.mockRejectedValue(new NotFoundException("Project pitch not found"));

        await expect(controller.projectPitchGet({ uuid: "non-existent-uuid" })).rejects.toThrow(NotFoundException);
      });

      it("should throw BadRequestException for invalid UUID", async () => {
        projectPitchService.getProjectPitch.mockRejectedValue(new BadRequestException("Invalid UUID"));

        await expect(controller.projectPitchGet({ uuid: "invalid-uuid" })).rejects.toThrow(BadRequestException);
      });

      it("should handle unexpected errors gracefully", async () => {
        projectPitchService.getProjectPitch.mockRejectedValue(new Error("Unexpected error"));

        await expect(controller.projectPitchGet({ uuid: "1" })).rejects.toThrow(Error);
      });
    });
  });
});
