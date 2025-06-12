import { Injectable, NotFoundException } from "@nestjs/common";
import { Project, Task } from "@terramatch-microservices/database/entities";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { PolicyService } from "@terramatch-microservices/common";
import { processBulkApprovalDto, ReportType } from "./dto/process-bulk-approval.dto";
import { APPROVED } from "@terramatch-microservices/database/constants/status";

@Injectable()
export class ProcessBulkApprovalService {
  private readonly logger = new TMLogger(ProcessBulkApprovalService.name);

  constructor(private readonly policyService: PolicyService) {}

  async processbulkApproval(projectUuid: string): Promise<processBulkApprovalDto> {
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
          attributes: ["title", "submittedAt", "nothingToReport", "uuid", "status"],
          include: [{ association: "site", attributes: ["name"] }]
        },
        {
          association: "nurseryReports",
          attributes: ["title", "submittedAt", "nothingToReport", "uuid", "status"],
          include: [{ association: "nursery", attributes: ["name"] }]
        }
      ]
    });

    this.logger.log(`Processing ${tasks.length} tasks for project ${projectUuid}`);

    const allReports = tasks.flatMap(task => {
      const siteReports = (task.siteReports ?? [])
        .filter(report => report.nothingToReport && report.status !== APPROVED)
        .map(report => ({
          uuid: report.uuid,
          name: report.title ?? report.site?.name ?? "Unnamed Site Report",
          type: ReportType.SITE_REPORT,
          submittedAt: report.submittedAt,
          status: report.status,
          nothingToReport: report.nothingToReport
        }));

      const nurseryReports = (task.nurseryReports ?? [])
        .filter(report => report.nothingToReport && report.status !== APPROVED)
        .map(report => ({
          uuid: report.uuid,
          name: report.title ?? report.nursery?.name ?? "Unnamed Nursery Report",
          type: ReportType.NURSERY_REPORT,
          submittedAt: report.submittedAt,
          status: report.status,
          nothingToReport: report.nothingToReport
        }));

      return [...siteReports, ...nurseryReports];
    });

    return {
      projectUuid,
      reportsBulkApproval: allReports
    } as processBulkApprovalDto;
  }
}
