import { Test, TestingModule } from "@nestjs/testing";
import { ProcessBulkApprovalController } from "./process-bulk-approval.controller";
import { ProcessBulkApprovalService } from "./process-bulk-approval.service";
import { PolicyService } from "@terramatch-microservices/common";
import { processBulkApprovalDto, ReportType } from "./dto/process-bulk-approval.dto";
import { NotFoundException } from "@nestjs/common";

describe("ProcessBulkApprovalController", () => {
  let controller: ProcessBulkApprovalController;
  let service: ProcessBulkApprovalService;

  const mockService = {
    processBulkApproval: jest.fn(),
    approveReports: jest.fn()
  };

  const mockPolicyService = {
    authorize: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcessBulkApprovalController],
      providers: [
        {
          provide: ProcessBulkApprovalService,
          useValue: mockService
        },
        {
          provide: PolicyService,
          useValue: mockPolicyService
        }
      ]
    }).compile();

    controller = module.get<ProcessBulkApprovalController>(ProcessBulkApprovalController);
    service = module.get<ProcessBulkApprovalService>(ProcessBulkApprovalService);
  });

  describe("processBulkApproval", () => {
    it("should return project tasks and reports for a valid project UUID", async () => {
      const mockResponse: processBulkApprovalDto = {
        projectUuid: "test-uuid",
        reportsBulkApproval: [
          {
            name: "Test Report",
            type: ReportType.SITE_REPORT,
            submittedAt: new Date(),
            status: "approved",
            uuid: "report-uuid",
            nothingToReport: false
          }
        ]
      };

      mockService.processBulkApproval.mockResolvedValue(mockResponse);

      const result = await controller.processbulkApproval("test-uuid");

      expect(result).toEqual({
        data: {
          attributes: mockResponse,
          id: "test-uuid",
          type: "processBulkApproval"
        },
        meta: {
          resourceType: "processBulkApproval"
        }
      });
      expect(service.processbulkApproval).toHaveBeenCalledWith("test-uuid");
    });

    it("should throw NotFoundException for non-existent project", async () => {
      mockService.processBulkApproval.mockRejectedValue(new NotFoundException());

      await expect(controller.processbulkApproval("non-existent")).rejects.toThrow(NotFoundException);
    });
  });
});
