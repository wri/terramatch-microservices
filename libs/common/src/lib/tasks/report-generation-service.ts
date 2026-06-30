import { Injectable, NotFoundException } from "@nestjs/common";
import { TMLogger } from "../util/tm-logger";
import {
  Action,
  FinancialReport,
  Nursery,
  NurseryReport,
  Organisation,
  Project,
  ProjectReport,
  Site,
  SiteReport,
  SrpReport,
  Task
} from "@terramatch-microservices/database/entities";
import { FINANCIAL_REPORT_FRAMEWORKS, FrameworkKey } from "@terramatch-microservices/database/constants";
import { DUE, PENDING } from "@terramatch-microservices/database/constants/status";
import { DateTime } from "luxon";
import { Op } from "sequelize";
import { uniq } from "lodash";

@Injectable()
export class ReportGenerationService {
  private logger = new TMLogger(ReportGenerationService.name);

  /**
   * Creates a task for the given project with the given due date, including all required
   * project, site and nursery reports.
   */
  async createTask(projectId: number, dueAt: Date) {
    if ((await Task.count({ where: { projectId, dueAt } })) > 0) {
      this.logger.warn(`Task already exists for project ${projectId} due at ${dueAt}`);
      return;
    }

    const project = await Project.findOne({
      where: { id: projectId },
      attributes: ["id", "frameworkKey", "organisationId"]
    });
    if (project == null) {
      throw new NotFoundException(`Project not found [${projectId}]`);
    }

    const dueDateTime = DateTime.fromJSDate(dueAt);
    const periodKey = `${dueDateTime.year}-${dueDateTime.month}`;

    const task = await Task.create({
      organisationId: project.organisationId,
      projectId: project.id,
      status: DUE,
      periodKey,
      dueAt
    } as Task);

    const labels = ["Project"];
    const projectReport = await ProjectReport.create({
      taskId: task.id,
      frameworkKey: project.frameworkKey,
      projectId: project.id,
      status: DUE,
      dueAt
    } as ProjectReport);

    const sites = await Site.nonDraft()
      .project(projectId)
      .findAll({ attributes: ["id"] });
    if (sites.length > 0) {
      labels.push("site");
      await SiteReport.bulkCreate(
        sites.map(
          ({ id }) =>
            ({
              taskId: task.id,
              frameworkKey: project.frameworkKey,
              siteId: id,
              status: DUE,
              dueAt
            }) as SiteReport
        )
      );
    }

    const nurseries = await Nursery.nonDraft()
      .project(projectId)
      .findAll({ attributes: ["id"] });
    if (nurseries.length > 0) {
      labels.push("nursery");
      await NurseryReport.bulkCreate(
        nurseries.map(
          ({ id }) =>
            ({
              taskId: task.id,
              frameworkKey: project.frameworkKey,
              nurseryId: id,
              status: DUE,
              dueAt
            }) as NurseryReport
        )
      );
    }

    // these reports are only available for the ppc framework
    if (project.frameworkKey === "ppc" && dueDateTime.month === 1) {
      const srpReport = await SrpReport.create({
        taskId: task.id,
        frameworkKey: project.frameworkKey,
        projectId: project.id,
        status: DUE,
        dueAt
      } as SrpReport);

      await Action.create({
        status: PENDING,
        targetableType: SrpReport.LARAVEL_TYPE,
        targetableId: srpReport.id,
        type: "notification",
        title: "Srp report",
        subTitle: "",
        text: "Annual Socioeconomic Restoration Partners Report available",
        projectId: project.id,
        organisationId: project.organisationId
      } as Action);
    }

    await Action.create({
      status: PENDING,
      targetableType: ProjectReport.LARAVEL_TYPE,
      targetableId: projectReport.id,
      type: "notification",
      title: "Project report",
      subTitle: "",
      text: `${labels.join(", ")} ${labels.length > 1 ? "reports" : "report"} available`,
      projectId: project.id,
      organisationId: project.organisationId
    } as Action);
  }

  /**
   * Creates annual financial reports for each organisation with projects in the given framework.
   * Only runs for January annual report generation (aligned with project/site/nursery reports).
   */
  async createFinancialReports(frameworkKey: FrameworkKey, dueAt: Date) {
    if (!(FINANCIAL_REPORT_FRAMEWORKS as readonly FrameworkKey[]).includes(frameworkKey)) {
      return;
    }

    const dueDateTime = DateTime.fromJSDate(dueAt, { zone: "utc" });
    if (dueDateTime.month !== 1) {
      return;
    }

    const yearOfReport = dueDateTime.year;
    const financialDueAt = DateTime.utc(yearOfReport, 7, 30).toJSDate();

    const organisationIds = uniq(
      (
        await Project.findAll({
          where: { frameworkKey, status: { [Op.ne]: "started" }, organisationId: { [Op.ne]: null } },
          attributes: ["organisationId"]
        })
      )
        .map(({ organisationId }) => organisationId)
        .filter((id): id is number => id != null)
    );

    for (const organisationId of organisationIds) {
      if (
        (await FinancialReport.count({
          where: { organisationId, yearOfReport }
        })) > 0
      ) {
        this.logger.warn(
          `Financial report already exists for organisation ${organisationId} year ${yearOfReport}, skipping`
        );
        continue;
      }

      const organisation = await Organisation.findByPk(organisationId, {
        attributes: ["finStartMonth", "currency"]
      });

      await FinancialReport.create({
        organisationId,
        title: `Financial Report ${yearOfReport}`,
        yearOfReport,
        status: DUE,
        frameworkKey,
        dueAt: financialDueAt,
        finStartMonth: organisation?.finStartMonth ?? null,
        currency: organisation?.currency ?? null
      } as FinancialReport);
    }
  }
}
