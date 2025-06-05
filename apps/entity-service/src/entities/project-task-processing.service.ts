import { Injectable, NotFoundException } from "@nestjs/common";
import { Project, Task, SiteReport, NurseryReport } from "@terramatch-microservices/database/entities";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { PolicyService } from "@terramatch-microservices/common";
import {
  ProjectTaskProcessingResponseDto,
  ReportType,
  ApproveReportsResponseDto
} from "./dto/project-task-processing.dto";
import { APPROVED } from "@terramatch-microservices/database/constants/status";

@Injectable()
export class ProjectTaskProcessingService {
  private readonly logger = new TMLogger(ProjectTaskProcessingService.name);

  constructor(private readonly policyService: PolicyService) {}

  async processProjectTasks(projectUuid: string): Promise<ProjectTaskProcessingResponseDto> {
    const project = await Project.findOne({
      where: { uuid: projectUuid }
    });

    if (project == null) {
      throw new NotFoundException(`Project with UUID ${projectUuid} not found`);
    }

    await this.policyService.authorize("read", project);

    const tasks = await Task.findAll({
      where: { projectId: project.id },
      include: [
        {
          association: "siteReports",
          attributes: ["title", "submittedAt", "nothingToReport", "uuid"],
          include: [{ association: "site", attributes: ["name"] }]
        },
        {
          association: "nurseryReports",
          attributes: ["title", "submittedAt", "nothingToReport", "uuid"],
          include: [{ association: "nursery", attributes: ["name"] }]
        }
      ]
    });

    this.logger.log(`Processing ${tasks.length} tasks for project ${projectUuid}`);

    const allReports = tasks.flatMap(task => {
      const siteReports = (task.siteReports ?? [])
        .filter(report => report.nothingToReport)
        .map(report => ({
          uuid: report.uuid,
          name: report.title ?? report.site?.name ?? "Unnamed Site Report",
          type: ReportType.SITE_REPORT,
          submittedAt: report.submittedAt,
          taskUuid: task.uuid,
          nothingToReport: report.nothingToReport
        }));

      const nurseryReports = (task.nurseryReports ?? [])
        .filter(report => report.nothingToReport)
        .map(report => ({
          uuid: report.uuid,
          name: report.title ?? report.nursery?.name ?? "Unnamed Nursery Report",
          type: ReportType.NURSERY_REPORT,
          submittedAt: report.submittedAt,
          taskUuid: task.uuid,
          nothingToReport: report.nothingToReport
        }));

      return [...siteReports, ...nurseryReports];
    });

    return {
      projectUuid,
      projectName: project.name,
      reports: allReports
    } as ProjectTaskProcessingResponseDto;
  }

  async approveReports(reportUuids: string[]): Promise<ApproveReportsResponseDto> {
    // Find all reports with the given UUIDs
    const [siteReports, nurseryReports] = await Promise.all([
      SiteReport.findAll({
        where: { uuid: reportUuids, nothingToReport: true }
      }),
      NurseryReport.findAll({
        where: { uuid: reportUuids, nothingToReport: true }
      })
    ]);

    const totalApproved = siteReports.length + nurseryReports.length;

    // Update all found reports to approved status
    await Promise.all([
      ...siteReports.map(report => report.update({ status: APPROVED })),
      ...nurseryReports.map(report => report.update({ status: APPROVED }))
    ]);

    this.logger.log(`Approved ${totalApproved} reports`);

    return {
      approvedCount: totalApproved,
      message: `Successfully approved ${totalApproved} reports`
    };
  }
}
