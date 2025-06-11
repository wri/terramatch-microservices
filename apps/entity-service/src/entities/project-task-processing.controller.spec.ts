import { Test, TestingModule } from "@nestjs/testing";
import { ProjectTaskProcessingController } from "./project-task-processing.controller";
import { ProjectTaskProcessingService } from "./project-task-processing.service";
import { PolicyService } from "@terramatch-microservices/common";
import { ProjectTaskProcessingResponseDto, ReportType } from "./dto/project-task-processing.dto";
import { NotFoundException } from "@nestjs/common";

describe("ProjectTaskProcessingController", () => {
  let controller: ProjectTaskProcessingController;
  let service: ProjectTaskProcessingService;

  const mockService = {
    processProjectTasks: jest.fn(),
    approveReports: jest.fn()
  };

  const mockPolicyService = {
    authorize: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectTaskProcessingController],
      providers: [
        {
          provide: ProjectTaskProcessingService,
          useValue: mockService
        },
        {
          provide: PolicyService,
          useValue: mockPolicyService
        }
      ]
    }).compile();

    controller = module.get<ProjectTaskProcessingController>(ProjectTaskProcessingController);
    service = module.get<ProjectTaskProcessingService>(ProjectTaskProcessingService);
  });

  describe("processProjectTasks", () => {
    it("should return project tasks and reports for a valid project UUID", async () => {
      const mockResponse: ProjectTaskProcessingResponseDto = {
        projectName: "Test Project",
        projectUuid: "test-uuid",
        reports: [
          {
            name: "Test Report",
            type: ReportType.SITE_REPORT,
            submittedAt: new Date(),
            taskUuid: "task-uuid",
            uuid: "report-uuid",
            nothingToReport: false
          }
        ]
      };

      mockService.processProjectTasks.mockResolvedValue(mockResponse);

      const result = await controller.processProjectTasks("test-uuid");

      expect(result).toEqual({
        data: {
          attributes: mockResponse,
          id: "test-uuid",
          type: "processProjectTasks"
        },
        meta: {
          resourceType: "processProjectTasks"
        }
      });
      expect(service.processProjectTasks).toHaveBeenCalledWith("test-uuid");
    });

    it("should throw NotFoundException for non-existent project", async () => {
      mockService.processProjectTasks.mockRejectedValue(new NotFoundException());

      await expect(controller.processProjectTasks("non-existent")).rejects.toThrow(NotFoundException);
    });
  });
});
