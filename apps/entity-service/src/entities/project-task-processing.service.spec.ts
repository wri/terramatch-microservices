import { Test, TestingModule } from "@nestjs/testing";
import { ProjectTaskProcessingService } from "./project-task-processing.service";
import { PolicyService } from "@terramatch-microservices/common";
import { Project, Task, SiteReport, NurseryReport, User } from "@terramatch-microservices/database/entities";
import { createMock } from "@golevelup/ts-jest";
import { NotFoundException } from "@nestjs/common";
import { APPROVED } from "@terramatch-microservices/database/constants/status";
import { RequestContext } from "nestjs-request-context";
import { Op } from "sequelize";

describe("ProjectTaskProcessingService", () => {
  let service: ProjectTaskProcessingService;
  let policyService: jest.Mocked<PolicyService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectTaskProcessingService,
        {
          provide: PolicyService,
          useValue: createMock<PolicyService>()
        }
      ]
    }).compile();

    service = module.get<ProjectTaskProcessingService>(ProjectTaskProcessingService);
    policyService = module.get(PolicyService);
  });

  describe("processProjectTasks", () => {
    it("should throw NotFoundException when project is not found", async () => {
      jest.spyOn(Project, "findOne").mockResolvedValue(null);
      await expect(service.processProjectTasks("non-existent-uuid")).rejects.toThrow(NotFoundException);
    });

    it("should process tasks and return reports for a valid project", async () => {
      const mockProject = {
        id: 1,
        uuid: "test-uuid",
        name: "Test Project"
      } as Project;

      const mockTask = {
        uuid: "task-uuid",
        siteReports: [
          {
            uuid: "site-report-uuid",
            title: "Site Report",
            submittedAt: new Date(),
            nothingToReport: true,
            site: { name: "Test Site" }
          }
        ],
        nurseryReports: [
          {
            uuid: "nursery-report-uuid",
            title: "Nursery Report",
            submittedAt: new Date(),
            nothingToReport: true,
            nursery: { name: "Test Nursery" }
          }
        ]
      } as Task;

      jest.spyOn(Project, "findOne").mockResolvedValue(mockProject);
      jest.spyOn(Task, "findAll").mockResolvedValue([mockTask]);

      const result = await service.processProjectTasks("test-uuid");

      expect(result).toEqual({
        projectUuid: "test-uuid",
        projectName: "Test Project",
        reports: expect.arrayContaining([
          expect.objectContaining({
            uuid: "site-report-uuid",
            type: "siteReport",
            nothingToReport: true
          }),
          expect.objectContaining({
            uuid: "nursery-report-uuid",
            type: "nurseryReport",
            nothingToReport: true
          })
        ])
      });
    });
  });

  describe("approveReports", () => {
    const mockUser = {
      id: 1,
      emailAddress: "test@example.com",
      firstName: "Test",
      lastName: "User"
    } as User;

    const mockSiteReport = {
      id: 1,
      uuid: "site-report-uuid"
    } as SiteReport;

    const mockNurseryReport = {
      id: 2,
      uuid: "nursery-report-uuid"
    } as NurseryReport;

    beforeEach(() => {
      jest.spyOn(User, "findByPk").mockResolvedValue(mockUser);
      jest.spyOn(SiteReport, "findAll").mockResolvedValue([mockSiteReport]);
      jest.spyOn(NurseryReport, "findAll").mockResolvedValue([mockNurseryReport]);
      jest.spyOn(SiteReport, "update").mockResolvedValue([1]);
      jest.spyOn(NurseryReport, "update").mockResolvedValue([1]);
      jest.spyOn(RequestContext, "currentContext", "get").mockReturnValue({
        req: { authenticatedUserId: 1 }
      } as any);
    });

    it("should approve reports and create audit statuses", async () => {
      const result = await service.approveReports({
        uuid: "project-uuid",
        reportUuids: ["site-report-uuid", "nursery-report-uuid"],
        feedback: "Test feedback"
      });

      expect(result).toEqual({
        approvedCount: 2,
        message: "Successfully approved 2 reports"
      });

      expect(SiteReport.update).toHaveBeenCalledWith({ status: APPROVED }, { where: { id: { [Op.in]: [1] } } });

      expect(NurseryReport.update).toHaveBeenCalledWith({ status: APPROVED }, { where: { id: { [Op.in]: [2] } } });
    });

    it("should handle missing authenticated user", async () => {
      jest.spyOn(RequestContext, "currentContext", "get").mockReturnValue({
        req: {}
      } as any);

      const result = await service.approveReports({
        uuid: "project-uuid",
        reportUuids: ["site-report-uuid", "nursery-report-uuid"]
      });

      expect(result).toEqual({
        approvedCount: 2,
        message: "Successfully approved 2 reports"
      });
    });
  });
});
