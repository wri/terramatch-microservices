import { Injectable, NotFoundException } from "@nestjs/common";
import { Project, Task, SiteReport, NurseryReport, AuditStatus } from "@terramatch-microservices/database/entities";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { PolicyService } from "@terramatch-microservices/common";
import {
  ProjectTaskProcessingResponseDto,
  ReportType,
  ApproveReportsResponseDto,
  ApproveReportsDto
} from "./dto/project-task-processing.dto";
import { APPROVED } from "@terramatch-microservices/database/constants/status";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { RequestContext } from "nestjs-request-context";
import { User } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { Attributes } from "sequelize";

@Injectable()
export class ProjectTaskProcessingService {
  private readonly logger = new TMLogger(ProjectTaskProcessingService.name);

  constructor(private readonly policyService: PolicyService) {}

  private async getAuthenticatedUser(): Promise<User | null> {
    const context = RequestContext.currentContext;
    if (!context?.req?.authenticatedUserId) {
      return null;
    }
    return User.findByPk(context.req.authenticatedUserId);
  }

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
          taskUuid: task.uuid,
          nothingToReport: report.nothingToReport
        }));

      const nurseryReports = (task.nurseryReports ?? [])
        .filter(report => report.nothingToReport && report.status !== APPROVED)
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

  async approveReports(params: ApproveReportsDto): Promise<ApproveReportsResponseDto> {
    const [siteReports, nurseryReports] = await Promise.all([
      SiteReport.findAll({
        attributes: ["id", "uuid"],
        where: { uuid: params.reportUuids, nothingToReport: true }
      }),
      NurseryReport.findAll({
        attributes: ["id", "uuid"],
        where: { uuid: params.reportUuids, nothingToReport: true }
      })
    ]);

    const user = await this.getAuthenticatedUser();
    const allReports = [...siteReports, ...nurseryReports];

    await Promise.all([
      SiteReport.update({ status: APPROVED }, { where: { id: { [Op.in]: siteReports.map(r => r.id) } } }),
      NurseryReport.update({ status: APPROVED }, { where: { id: { [Op.in]: nurseryReports.map(r => r.id) } } })
    ]);

    const auditStatusRecords = allReports.map(report => ({
      auditableType: laravelType(report),
      auditableId: report.id,
      createdBy: user?.emailAddress ?? null,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      status: APPROVED,
      comment: `Approved: ${params.feedback ?? ""}`
    })) as Array<Attributes<AuditStatus>>;

    await AuditStatus.bulkCreate(auditStatusRecords);

    const totalApproved = allReports.length;
    this.logger.log(`Approved ${totalApproved} reports`);

    return {
      approvedCount: totalApproved,
      message: `Successfully approved ${totalApproved} reports`
    };
  }
}
