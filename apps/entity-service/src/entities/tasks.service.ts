import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  ProjectReport,
  ProjectUser,
  SiteReport,
  Task,
  TreeSpecies,
  User,
  AuditStatus,
  NurseryReport
} from "@terramatch-microservices/database/entities";
import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { TaskFullDto } from "./dto/task.dto";
import { EntitiesService, ProcessableEntity } from "./entities.service";
import { ReportModel } from "@terramatch-microservices/database/constants/entities";
import { TMLogger } from "@terramatch-microservices/common/util/tm-logger";
import { TaskQueryDto } from "./dto/task-query.dto";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Op } from "sequelize";
import { PolicyService } from "@terramatch-microservices/common";
import { AWAITING_APPROVAL, APPROVED } from "@terramatch-microservices/database/constants/status";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { Attributes } from "sequelize";
import { ModelCtor } from "sequelize-typescript";
import { TaskUpdateAttributes } from "./dto/task-update.dto";
import { filter } from "lodash";

const FILTER_PROPS = {
  status: "status",
  frameworkKey: "$project.framework_key$",
  projectUuid: "$project.uuid$"
};

@Injectable()
export class TasksService {
  private logger = new TMLogger(TasksService.name);

  constructor(private readonly entitiesService: EntitiesService, private readonly policyService: PolicyService) {}

  async getTasks(query: TaskQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Task, query.page, [
      // required: true avoids loading tasks attached to deleted projects or orgs
      { association: "organisation", attributes: ["name"], required: true },
      // Project framework key is required for the policy (see task.policy.ts `frameworkKey` checks,
      // and the `get frameworkKey` method in task.entity.ts
      { association: "project", attributes: ["name", "frameworkKey"], required: true }
    ]);

    const permissions = await this.policyService.getPermissions();
    const frameworkPermissions = permissions
      ?.filter(name => name.startsWith("framework-"))
      ?.map(name => name.substring("framework-".length) as string);
    if (frameworkPermissions?.length > 0) {
      builder.where({ "$project.framework_key$": { [Op.in]: frameworkPermissions } });
    } else {
      if (query.projectUuid == null) {
        const userId = this.policyService.userId;
        if (userId == null) throw new BadRequestException("Cannot get tasks without a user");
        // non-admin users should typically be filtering on a project, but to cover our bases,
        // return all tasks they have direct access to if they aren't.
        if (permissions?.includes("manage-own")) {
          builder.where({ projectId: { [Op.in]: ProjectUser.userProjectsSubquery(userId) } });
        } else if (permissions?.includes("projects-manage")) {
          builder.where({ projectId: { [Op.in]: ProjectUser.projectsManageSubquery(userId) } });
        }
      }

      if (query.sort == null) {
        // For non-admins, the default sort is dueAt descending
        builder.order(["dueAt", "DESC"]);
      }
    }

    for (const [filterProp, sqlProp] of Object.entries(FILTER_PROPS)) {
      if (query[filterProp] != null) {
        builder.where({ [sqlProp]: query[filterProp] });
      }
    }

    if (query.sort?.field != null) {
      if (["dueAt", "updatedAt", "status"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "organisationName") {
        builder.order(["organisation", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["project", "name", query.sort.direction ?? "ASC"]);
      }
    }

    return { tasks: await builder.execute(), total: await builder.paginationTotal() };
  }

  async getTask(uuid: string) {
    const task = await Task.findOne({
      where: { uuid },
      include: [
        { association: "organisation", attributes: ["name"], required: true },
        // Project framework key is required for the policy (see task.policy.ts `frameworkKey` checks,
        // and the `get frameworkKey` method in task.entity.ts
        { association: "project", attributes: ["name", "frameworkKey"], required: true }
      ]
    });
    if (task == null) throw new NotFoundException();

    return task;
  }

  async addFullTaskDto(document: DocumentBuilder, task: Task) {
    const treesPlantedCount =
      (await TreeSpecies.visible()
        .collection("tree-planted")
        .siteReports(SiteReport.approvedIdsForTaskSubquery(task.id))
        .sum("amount")) ?? 0;

    const taskResource = document.addData(task.uuid, new TaskFullDto(task, { treesPlantedCount }));
    await this.loadReports(task);
    for (const entityType of ["projectReports", "siteReports", "nurseryReports", "srpReports"] as ProcessableEntity[]) {
      const processor = this.entitiesService.createEntityProcessor(entityType);
      if (entityType === "projectReports" && task.projectReport != null) {
        const { id, dto } = await processor.getLightDto(task.projectReport);
        taskResource.relateTo("projectReport", document.addData(id, dto));
      } else {
        for (const report of task[entityType] ?? []) {
          const { id, dto } = await processor.getLightDto(report);
          taskResource.relateTo(entityType, document.addData(id, dto), { forceMultiple: true });
        }
      }
    }

    return document;
  }

  async submitForApproval(task: Task) {
    if (task.status === "awaiting-approval") return;

    if (!task.statusCanBe("awaiting-approval")) {
      throw new BadRequestException('Task cannot transition to "awaiting-approval" status.');
    }

    await this.loadReports(task);

    // First, make sure all the reports are either complete or are completable
    const reports: ReportModel[] = [...(task.siteReports ?? []), ...(task.nurseryReports ?? [])];
    if (task.projectReport != null) reports.unshift(task.projectReport);
    if (reports.find(report => !report.isCompletable) != null) {
      throw new BadRequestException("Task is not submittable due to incomplete reports");
    }

    // Then, ensure all reports are in a complete state. This is done after checking all reports to avoid
    // submitting a report if other reports in the task aren't yet submittable.
    for (const report of reports) {
      if (report.isComplete) continue;

      if (report.completion === 0 && !(report instanceof ProjectReport)) {
        report.nothingToReport = true;
      } else {
        report.completion = 100;
      }

      if (report.submittedAt == null) {
        report.submittedAt = new Date();
      }

      report.status = AWAITING_APPROVAL;
      await report.save();
    }

    task.status = AWAITING_APPROVAL;
  }

  async approveBulkReports(attributes: TaskUpdateAttributes, task: Task): Promise<void> {
    const user = await User.findOne({
      where: { id: this.entitiesService.userId },
      attributes: ["id", "firstName", "lastName", "emailAddress"]
    });
    const taskId = task.id;

    await this.updateReportsStatus(SiteReport, attributes.siteReportNothingToReportUuids ?? [], APPROVED, taskId);
    await this.updateReportsStatus(NurseryReport, attributes.nurseryReportNothingToReportUuids ?? [], APPROVED, taskId);

    await this.loadReports(task);

    const siteReports = filter(
      (attributes.siteReportNothingToReportUuids ?? []).map(uuid =>
        task.siteReports?.find(siteReport => siteReport.uuid === uuid)
      )
    ) as SiteReport[];
    const nurseryReports = filter(
      (attributes.nurseryReportNothingToReportUuids ?? []).map(uuid =>
        task.nurseryReports?.find(nurseryReport => nurseryReport.uuid === uuid)
      )
    ) as NurseryReport[];

    const auditStatusRecords = [
      ...this.createAuditStatusRecords(siteReports, user, attributes.feedback ?? ""),
      ...this.createAuditStatusRecords(nurseryReports, user, attributes.feedback ?? "")
    ] as Array<Attributes<AuditStatus>>;

    if (auditStatusRecords.length > 0) {
      await AuditStatus.bulkCreate(auditStatusRecords);
    }
  }

  private async updateReportsStatus<T extends ReportModel>(
    modelClass: ModelCtor<T>,
    uuids: string[],
    status: string,
    taskId: number
  ): Promise<void> {
    if (uuids == null) return;

    await modelClass.update({ status: status }, { where: { uuid: { [Op.in]: uuids }, taskId } });
  }

  private createAuditStatusRecords(
    reports: ReportModel[],
    user: User | null,
    feedback: string | null
  ): Array<Partial<AuditStatus>> {
    return reports.map(report => ({
      auditableType: laravelType(report),
      auditableId: report.id,
      createdBy: user?.emailAddress ?? null,
      firstName: user?.firstName ?? null,
      lastName: user?.lastName ?? null,
      status: APPROVED,
      comment: feedback ?? null
    }));
  }
  private async loadReports(task: Task) {
    if (task.projectReport != null) return;

    for (const entityType of ["projectReports", "siteReports", "nurseryReports", "srpReports"] as ProcessableEntity[]) {
      const processor = this.entitiesService.createEntityProcessor(entityType);
      const { models } = await processor.findMany({ taskId: task.id });
      if (entityType === "projectReports") {
        if (models.length > 1) {
          this.logger.error(`More than one project report found for task ${task.id}`);
          models.length = 1;
        }
        task.projectReport = models[0] as ProjectReport;
      } else {
        task[entityType] = models;
      }
    }
  }
}
