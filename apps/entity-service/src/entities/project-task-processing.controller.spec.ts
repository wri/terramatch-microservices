import { Test, TestingModule } from "@nestjs/testing";
import { ProjectTaskProcessingController } from "./project-task-processing.controller";
import { ProjectTaskProcessingService } from "./project-task-processing.service";
import { PolicyService } from "@terramatch-microservices/common";
import {
  ProjectTaskProcessingResponseDto,
  ApproveReportsDto,
  ApproveReportsResponseDto,
  ReportType,
  ReportDto
} from "./dto/project-task-processing.dto";
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

  describe("approveReports", () => {
    it("should approve reports and return success message", async () => {
      const mockResponse: ApproveReportsResponseDto = {
        approvedCount: 2,
        message: "Successfully approved 2 reports"
      };

      mockService.approveReports.mockResolvedValue(mockResponse);

      const result = await controller.approveReports({
        uuid: "project-uuid",
        reportUuids: ["report1-uuid", "report2-uuid"]
      });

      expect(result).toEqual({
        data: {
          attributes: mockResponse,
          id: "approveReports",
          type: "approveReportsResponse"
        },
        meta: {
          resourceType: "approveReportsResponse"
        }
      });
      expect(service.approveReports).toHaveBeenCalledWith({
        uuid: "project-uuid",
        reportUuids: ["report1-uuid", "report2-uuid"]
      });
    });

    it("should handle empty report UUIDs array", async () => {
      const mockResponse: ApproveReportsResponseDto = {
        approvedCount: 0,
        message: "Successfully approved 0 reports"
      };

      mockService.approveReports.mockResolvedValue(mockResponse);

      const result = await controller.approveReports({
        uuid: "project-uuid",
        reportUuids: []
      });

      expect(result).toEqual({
        data: {
          attributes: mockResponse,
          id: "approveReports",
          type: "approveReportsResponse"
        },
        meta: {
          resourceType: "approveReportsResponse"
        }
      });
      expect(service.approveReports).toHaveBeenCalledWith({
        uuid: "project-uuid",
        reportUuids: []
      });
    });
  });
});
