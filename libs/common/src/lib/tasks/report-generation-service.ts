import { Injectable, NotFoundException } from "@nestjs/common";
import { TMLogger } from "../util/tm-logger";
import {
  Action,
  FinancialIndicator,
  FinancialReport,
  FundingType,
  Media,
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
import { DUE, NO_UPDATE, PENDING } from "@terramatch-microservices/database/constants/status";
import { DateTime } from "luxon";
import { Op } from "sequelize";
import { uniq } from "lodash";
import { MediaService } from "../media/media.service";

@Injectable()
export class ReportGenerationService {
  private logger = new TMLogger(ReportGenerationService.name);

  constructor(private readonly mediaService: MediaService) {}

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
   * Creates a financial report for a single organisation. Intended for manual use (REPL / one-offs).
   * yearOfReport is derived from the year of dueAt.
   */
  async createFinancialReport(organisationId: number, dueAt: Date) {
    const dueDateTime = DateTime.fromJSDate(dueAt, { zone: "utc" });
    const yearOfReport = dueDateTime.year;

    const project = await Project.findOne({
      where: {
        organisationId,
        status: { [Op.ne]: "started" },
        frameworkKey: { [Op.in]: [...FINANCIAL_REPORT_FRAMEWORKS] }
      },
      attributes: ["frameworkKey"],
      order: [["id", "ASC"]]
    });
    if (project?.frameworkKey == null) {
      throw new NotFoundException(
        `No eligible TerraFund project found for organisation ${organisationId} ` +
          `(frameworks: ${FINANCIAL_REPORT_FRAMEWORKS.join(", ")})`
      );
    }

    const organisation = await Organisation.findByPk(organisationId, {
      attributes: ["id", "uuid", "finStartMonth", "currency"]
    });
    if (organisation?.uuid == null) {
      throw new NotFoundException(`Organisation not found [${organisationId}]`);
    }

    const report = await FinancialReport.create({
      organisationId,
      title: `Financial Report ${yearOfReport}`,
      yearOfReport,
      status: DUE,
      updateRequestStatus: NO_UPDATE,
      frameworkKey: project.frameworkKey,
      dueAt,
      finStartMonth: organisation.finStartMonth ?? null,
      currency: organisation.currency ?? null
    } as FinancialReport);

    await this.cloneOrgFinancialDataToReport(organisation, report);

    return report;
  }

  private async cloneOrgFinancialDataToReport(organisation: Organisation, report: FinancialReport) {
    const orgIndicators = await FinancialIndicator.organisation(organisation.id).findAll();
    const orgDocumentation =
      orgIndicators.length === 0 ? [] : await Media.for(orgIndicators).collection("documentation").findAll();

    for (const indicator of orgIndicators) {
      const reportIndicator = await FinancialIndicator.create({
        organisationId: organisation.id,
        financialReportId: report.id,
        year: indicator.year,
        collection: indicator.collection,
        amount: indicator.amount,
        description: indicator.description,
        exchangeRate: indicator.exchangeRate
      });

      const documentation = orgDocumentation.filter(({ modelId }) => modelId === indicator.id);
      for (const media of documentation) {
        await this.mediaService.duplicateMedia(media, reportIndicator);
      }
    }

    const fundingTypes = await FundingType.organisation(organisation.uuid).findAll();
    if (fundingTypes.length > 0) {
      await FundingType.bulkCreate(
        fundingTypes.map(({ source, amount, year, type }) => ({
          organisationId: organisation.uuid,
          financialReportId: report.id,
          source,
          amount,
          year,
          type
        }))
      );
    }
  }

  /**
   * Creates annual financial reports for each organisation with projects in the given framework.
   * Runs on the same schedule as project/site/nursery reports but independently (no Task entity).
   * taskDueAt is the project report due date (typically Jan 31) used to derive the generation year;
   * financial report due_at is always July 30 of that year.
   */
  async createFinancialReports(frameworkKey: FrameworkKey, taskDueAt: Date) {
    if (!(FINANCIAL_REPORT_FRAMEWORKS as readonly FrameworkKey[]).includes(frameworkKey)) {
      return;
    }

    const dueDateTime = DateTime.fromJSDate(taskDueAt, { zone: "utc" });
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
      await this.createFinancialReport(organisationId, financialDueAt);
    }
  }
}
