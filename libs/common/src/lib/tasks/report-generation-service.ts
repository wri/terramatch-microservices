import { Injectable, NotFoundException } from "@nestjs/common";
import { TMLogger } from "../util/tm-logger";
import {
  Action,
  FinancialIndicator,
  FinancialReport,
  Framework,
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
import { ReportModel } from "@terramatch-microservices/database/constants/entities";
import { FrameworkFormUuidAttribute } from "@terramatch-microservices/database/entities/framework.entity";
import { laravelType } from "@terramatch-microservices/database/types/util";
import { DUE, PENDING } from "@terramatch-microservices/database/constants/status";
import { DateTime } from "luxon";
import { Op } from "sequelize";
import { uniq, upperFirst } from "lodash";
import { MediaService } from "../media/media.service";
import { ProductEventService } from "../product-events/product-event.service";

export const TASK_REPORT_FORM_ATTRIBUTES = [
  "projectReportFormUuid",
  "siteReportFormUuid",
  "nurseryReportFormUuid"
] as const satisfies FrameworkFormUuidAttribute[];

@Injectable()
export class ReportGenerationService {
  private logger = new TMLogger(ReportGenerationService.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly productEventService: ProductEventService
  ) {}

  /**
   * Creates a task for the given project with the given due date, including all required
   * project, site and nursery reports. Report types that do not have a form set on the project's
   * framework are skipped, and if no reports would be created, the task is not created.
   *
   * The framework may be passed in (including null for no framework) if it has already been loaded,
   * and must include TASK_REPORT_FORM_ATTRIBUTES; otherwise it is loaded from the project's framework key.
   */
  async createTask(projectId: number, dueAt: Date, framework?: Framework | null) {
    if ((await Task.count({ where: { projectId, dueAt } })) > 0) {
      this.logger.warn(`Task already exists for project ${projectId} due at ${dueAt}`);
      return;
    }

    const project = await Project.findOne({
      where: { id: projectId, isArchived: false },
      attributes: ["id", "frameworkKey", "organisationId"]
    });
    if (project == null) {
      throw new NotFoundException(`Project not found [${projectId}]`);
    }

    if (framework === undefined) {
      framework =
        project.frameworkKey == null
          ? null
          : await Framework.findOne({
              where: { slug: project.frameworkKey },
              attributes: [...TASK_REPORT_FORM_ATTRIBUTES]
            });
    }

    const dueDateTime = DateTime.fromJSDate(dueAt);
    // Annual SRP reports sit on the same task as project/site/nursery for the January PPC due date
    const createSrpReport = project.frameworkKey === "ppc" && dueDateTime.month === 1;

    const sites =
      framework?.siteReportFormUuid == null
        ? []
        : await Site.nonDraft()
            .project(projectId)
            .findAll({ attributes: ["id"], where: { isArchived: false } });
    const nurseries =
      framework?.nurseryReportFormUuid == null
        ? []
        : await Nursery.nonDraft()
            .project(projectId)
            .findAll({ attributes: ["id"], where: { isArchived: false } });

    const createProjectReport = framework?.projectReportFormUuid != null;
    if (!createProjectReport && sites.length === 0 && nurseries.length === 0 && !createSrpReport) {
      this.logger.log(`No reports to generate for project ${projectId} due at ${dueAt}; skipping task creation`);
      return;
    }

    const task = await Task.create({
      category: "project-reporting",
      organisationId: project.organisationId,
      projectId: project.id,
      status: DUE,
      dueAt
    });

    const labels: string[] = [];
    const reports: ReportModel[] = [];
    if (createProjectReport) {
      labels.push("project");
      reports.push(
        await ProjectReport.create({
          taskId: task.id,
          frameworkKey: project.frameworkKey,
          projectId: project.id,
          status: DUE,
          dueAt
        })
      );
    }

    if (sites.length > 0) {
      labels.push("site");
      reports.push(
        ...(await SiteReport.bulkCreate(
          sites.map(({ id }) => ({
            taskId: task.id,
            frameworkKey: project.frameworkKey,
            siteId: id,
            status: DUE,
            dueAt
          }))
        ))
      );
    }

    if (nurseries.length > 0) {
      labels.push("nursery");
      reports.push(
        ...(await NurseryReport.bulkCreate(
          nurseries.map(({ id }) => ({
            taskId: task.id,
            frameworkKey: project.frameworkKey,
            nurseryId: id,
            status: DUE,
            dueAt
          }))
        ))
      );
    }

    if (createSrpReport) {
      const srpReport = await SrpReport.create({
        taskId: task.id,
        frameworkKey: project.frameworkKey,
        projectId: project.id,
        status: DUE,
        dueAt,
        year: dueDateTime.year
      });

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
      });
    }

    // The notification for the task targets the first report generated (the project report, if present)
    const [primaryReport] = reports;
    if (primaryReport != null) {
      await Action.create({
        status: PENDING,
        targetableType: laravelType(primaryReport),
        targetableId: primaryReport.id,
        type: "notification",
        title: `${upperFirst(labels[0])} report`,
        subTitle: "",
        text: `${upperFirst(labels.join(", "))} ${labels.length > 1 ? "reports" : "report"} available`,
        projectId: project.id,
        organisationId: project.organisationId
      });
    }

    await this.productEventService.taskCreated(task);
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
        status: { [Op.ne]: "draft" },
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
      updateRequestStatus: null,
      frameworkKey: project.frameworkKey,
      dueAt,
      finStartMonth: organisation.finStartMonth ?? null,
      currency: organisation.currency ?? null
    });

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

    if (!(await Framework.hasForm(frameworkKey, "financialReportFormUuid"))) {
      this.logger.log(`No financial report form for framework ${frameworkKey}; skipping financial reports`);
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
          where: { frameworkKey, status: { [Op.ne]: "draft" }, organisationId: { [Op.ne]: null } },
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
