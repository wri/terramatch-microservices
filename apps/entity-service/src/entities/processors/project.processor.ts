import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Aggregate, aggregateColumns, EntityProcessor } from "./entity-processor";
import {
  Demographic,
  DemographicEntry,
  Nursery,
  NurseryReport,
  Project,
  ProjectReport,
  Seeding,
  Site,
  SitePolygon,
  SiteReport,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { Dictionary, groupBy, sumBy } from "lodash";
import { CountOptions, Op } from "sequelize";
import { AdditionalProjectFullProps, ANRDto, ProjectFullDto } from "../dto/project.dto";

export class ProjectProcessor extends EntityProcessor<Project> {
  readonly MODEL = Project;

  async addFullDto(document: DocumentBuilder, project: Project) {
    const approvedSites = await Site.findAll({
      where: { projectId: project.id, status: Site.APPROVED_STATUSES },
      attributes: ["id", "name"]
    });

    const approvedSiteReports =
      approvedSites.length === 0
        ? ([] as unknown as Dictionary<SiteReport[]>)
        : groupBy(
            await SiteReport.findAll({
              where: { siteId: { [Op.in]: approvedSites.map(({ id }) => id) }, status: SiteReport.APPROVED_STATUSES },
              attributes: ["id", "siteId", "numTreesRegenerating"]
            }),
            "siteId"
          );

    const assistedNaturalRegenerationList: ANRDto[] = approvedSites.map(({ id, name }) => ({
      name,
      treeCount: sumBy(approvedSiteReports[id], "numTreesRegenerating")
    }));
    const regeneratedTreesCount = sumBy(assistedNaturalRegenerationList, "treeCount");
    const treesPlantedCount =
      (await TreeSpecies.scope("visible").sum("amount", {
        where: {
          speciesableType: SiteReport.LARAVEL_TYPE,
          speciesableId: { [Op.in]: SiteReport.approvedIdsSubquery(Site.approvedIdsSubquery()) },
          collection: "treesPlanted"
        },
        replacements: { projectId: project.id }
      })) ?? 0;
    const seedsPlantedCount =
      (await Seeding.scope("visible").sum("amount", {
        where: {
          seedableType: SiteReport.LARAVEL_TYPE,
          seedableId: { [Op.in]: SiteReport.approvedIdsSubquery(Site.approvedIdsSubquery()) }
        },
        replacements: { projectId: project.id }
      })) ?? 0;

    const props: AdditionalProjectFullProps = {
      totalSites: approvedSites.length,
      totalNurseries: await Nursery.count({ where: { projectId: project.id, status: Nursery.APPROVED_STATUSES } }),
      totalOverdueReports: await this.getTotalOverdueReports(project.id),
      totalProjectReports: await ProjectReport.count({ where: { projectId: project.id } }),

      assistedNaturalRegenerationList,
      regeneratedTreesCount,
      treesPlantedCount,
      seedsPlantedCount,
      treesRestoredPpc:
        regeneratedTreesCount + (treesPlantedCount + seedsPlantedCount) * ((project.survivalRate ?? 0) / 100),

      totalHectaresRestoredSum: await this.getTotalHectaresRestored(project.id),

      workdayCount: await this.getWorkdayCount(project.id),
      selfReportedWorkdayCount: await this.getSelfReportedWorkdayCount(project.id),
      combinedWorkdayCount:
        (await this.getWorkdayCount(project.id, true)) + (await this.getSelfReportedWorkdayCount(project.id, true)),
      totalJobsCreated: await this.getTotalJobs(project.id)
    };

    document.addData(project.uuid, new ProjectFullDto(project as Project, props));
  }

  protected async getWorkdayCount(projectId: number, useDemographicsCutoff = false) {
    const dueAfterReplacement = useDemographicsCutoff ? ":dueAfter" : undefined;

    const siteIds = Site.approvedIdsSubquery();
    const siteReportIds = SiteReport.approvedIdsSubquery(siteIds, { dueAfterReplacement });
    const siteReportWorkdays = Demographic.idsSubquery(siteReportIds, ":siteReportType", ":workdayType");
    const projectReportIds = ProjectReport.approvedIdsSubquery({ dueAfterReplacement });
    const projectReportWorkdays = Demographic.idsSubquery(projectReportIds, ":projectReportType", ":workdayType");

    return (
      (await DemographicEntry.sum("amount", {
        where: {
          type: "gender",
          demographicId: {
            [Op.or]: [{ [Op.in]: siteReportWorkdays }, { [Op.in]: projectReportWorkdays }]
          }
        },
        replacements: {
          projectId,
          siteReportType: SiteReport.LARAVEL_TYPE,
          projectReportType: ProjectReport.LARAVEL_TYPE,
          workdayType: Demographic.WORKDAYS_TYPE,
          // Will be ignored if the :dueAfter replacement isn't included in the queries above.
          dueAfter: Demographic.DEMOGRAPHIC_COUNT_CUTOFF
        }
      })) ?? 0
    );
  }

  protected async getSelfReportedWorkdayCount(projectId: number, useDemographicsCutoff = false) {
    const dueBeforeReplacement = useDemographicsCutoff ? ":dueBefore" : undefined;
    const aggregates = [
      { func: "SUM", attr: "workdaysPaid" },
      { func: "SUM", attr: "workdaysVolunteer" }
    ];
    const replacements = {
      projectId,
      // Will be ignored if the :dueBefore replacement isn't included in the queries above.
      dueBefore: Demographic.DEMOGRAPHIC_COUNT_CUTOFF
    };

    const projectWhere = { id: { [Op.in]: ProjectReport.approvedIdsSubquery({ dueBeforeReplacement }) } };
    const siteWhere = {
      id: { [Op.in]: SiteReport.approvedIdsSubquery(Site.approvedIdsSubquery(), { dueBeforeReplacement }) }
    };

    const { workdaysPaid: sitePaid, workdaysVolunteer: siteVolunteer } = await aggregateColumns(
      SiteReport,
      aggregates as Aggregate<SiteReport>[],
      siteWhere,
      replacements
    );
    const { workdaysPaid: projectPaid, workdaysVolunteer: projectVolunteer } = await aggregateColumns(
      ProjectReport,
      aggregates as Aggregate<ProjectReport>[],
      projectWhere,
      replacements
    );

    return sitePaid + siteVolunteer + projectPaid + projectVolunteer;
  }

  protected async getTotalJobs(projectId: number) {
    const aggregates: Aggregate<ProjectReport>[] = [
      { func: "SUM", attr: "ftTotal" },
      { func: "SUM", attr: "ptTotal" }
    ];
    const where = { id: { [Op.in]: ProjectReport.approvedIdsSubquery() } };
    const { ftTotal, ptTotal } = await aggregateColumns(ProjectReport, aggregates, where, { projectId });

    return ftTotal + ptTotal;
  }

  protected async getTotalOverdueReports(projectId: number) {
    const now = new Date();
    const pTotal = await ProjectReport.scope("incomplete").count({
      where: { projectId, dueAt: { [Op.lt]: now } }
    });
    const sTotal = await SiteReport.scope("incomplete").count({
      where: {
        siteId: { [Op.in]: Site.approvedIdsSubquery() },
        dueAt: { [Op.lt]: now }
      },
      replacements: { projectId }
    } as CountOptions);
    const nTotal = await NurseryReport.scope("incomplete").count({
      where: {
        nurseryId: { [Op.in]: Nursery.approvedIdsSubquery() },
        dueAt: { [Op.lt]: now }
      },
      replacements: { projectId }
    } as CountOptions);

    return pTotal + sTotal + nTotal;
  }

  protected async getTotalHectaresRestored(projectId: number) {
    return (
      (await SitePolygon.scope("active").sum("calcArea", {
        where: {
          siteUuid: { [Op.in]: Site.approvedUuidsSubquery() },
          status: "approved"
        },
        replacements: { projectId }
      })) ?? 0
    );
  }

  protected findFullIncludes() {
    return [{ association: "framework" }];
  }
}
