import { Aggregate, aggregateColumns, EntityProcessor } from "./entity-processor";
import {
  Demographic,
  DemographicEntry,
  Media,
  Project,
  ProjectUser,
  ScheduledJob,
  Seeding,
  Site,
  SitePolygon,
  SiteReport,
  Task,
  TreeSpecies
} from "@terramatch-microservices/database/entities";
import { SiteFullDto, SiteLightDto, SiteMedia } from "../dto/site.dto";
import { BadRequestException, NotAcceptableException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { Includeable, Op } from "sequelize";
import { groupBy, sumBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { EntityUpdateAttributes } from "../dto/entity-update.dto";
import { PlantingStatus } from "@terramatch-microservices/database/constants/status";
import { EntityCreateAttributes } from "../dto/entity-create.dto";
import { DateTime } from "luxon";

const SIMPLE_FILTERS: (keyof EntityQueryDto)[] = [
  "status",
  "updateRequestStatus",
  "frameworkKey",
  "projectUuid",
  "organisationUuid",
  "country"
];

const ASSOCIATION_FIELD_MAP = {
  organisationUuid: "$project.organisation.uuid$",
  country: "$project.country$",
  projectUuid: "$project.uuid$"
};

export class SiteProcessor extends EntityProcessor<Site, SiteLightDto, SiteFullDto, EntityUpdateAttributes> {
  readonly LIGHT_DTO = SiteLightDto;
  readonly FULL_DTO = SiteFullDto;

  async findOne(uuid: string) {
    return await Site.findOne({
      where: { uuid },
      include: [
        {
          association: "project",
          attributes: ["uuid", "name", "country"],
          include: [{ association: "organisation", attributes: ["name", "uuid"] }]
        }
      ]
    });
  }

  async findMany(query: EntityQueryDto) {
    const projectAssociation: Includeable = {
      association: "project",
      attributes: ["uuid", "name"],
      include: [{ association: "organisation", attributes: ["uuid", "name"] }]
    };
    const frameworkAssociation: Includeable = {
      association: "framework",
      attributes: ["name"]
    };
    const builder = await this.entitiesService.buildQuery(Site, query, [projectAssociation, frameworkAssociation]);

    if (query.sort?.field != null) {
      if (["name", "status", "updateRequestStatus", "createdAt"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["project", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const permissions = await this.entitiesService.getPermissions();
    const frameworkPermissions = permissions
      ?.filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworkPermissions?.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions?.includes("manage-own")) {
      builder.where({
        projectId: { [Op.in]: ProjectUser.userProjectsSubquery(this.entitiesService.userId) }
      });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({
        projectId: { [Op.in]: ProjectUser.projectsManageSubquery(this.entitiesService.userId) }
      });
    }

    for (const term of SIMPLE_FILTERS) {
      const field = ASSOCIATION_FIELD_MAP[term] ?? term;
      if (query[term] != null) builder.where({ [field]: query[term] });
    }

    if (query.search != null || query.searchFilter != null) {
      builder.where({
        [Op.or]: [
          { name: { [Op.like]: `%${query.search ?? query.searchFilter}%` } },
          { "$project.name$": { [Op.like]: `%${query.search}%` } }
        ]
      });
    }

    if (query.projectUuid != null) {
      const project = await Project.findOne({ where: { uuid: query.projectUuid }, attributes: ["id"] });
      if (project == null) {
        throw new BadRequestException(`Project with uuid ${query.projectUuid} not found`);
      }
      builder.where({ projectId: project.id });
    }

    if (query.polygonStatus != null) {
      if (query.polygonStatus === "no-polygons") {
        builder.where({
          uuid: { [Op.notIn]: SitePolygon.siteUuidsWithPolygons() }
        });
      } else {
        builder.where({
          uuid: { [Op.in]: SitePolygon.siteUuidsForStatus(query.polygonStatus) }
        });
      }
    }

    if (query.plantingStatus != null) {
      builder.where({
        uuid: { [Op.in]: SiteReport.siteUuidsForLatestApprovedPlantingStatus(query.plantingStatus) }
      });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  private async getHectaresRestoredSum(siteUuids: string[]): Promise<Record<string, number>> {
    if (siteUuids.length === 0) return {};

    const polygons = await SitePolygon.findAll({
      where: {
        siteUuid: { [Op.in]: siteUuids },
        status: "approved",
        isActive: true,
        deletedAt: null
      },
      attributes: ["siteUuid", "calcArea"]
    });

    const hectaresMap: Record<string, number> = {};
    const polygonsBySite = groupBy(polygons, "siteUuid");

    for (const siteUuid of siteUuids) {
      const sitesPolygons = polygonsBySite[siteUuid] ?? [];
      hectaresMap[siteUuid] = sumBy(sitesPolygons, polygon => Number(polygon.calcArea) ?? 0);
    }

    return hectaresMap;
  }

  private async getTreesPlantedCount(sites: Site[]): Promise<Record<string, number>> {
    if (sites.length === 0) return {};

    const siteIds = sites.map(site => site.id);
    const approvedReports = await SiteReport.findAll({
      where: {
        siteId: { [Op.in]: siteIds },
        status: "approved"
      },
      attributes: ["id", "siteId"]
    });

    if (approvedReports.length === 0) {
      return sites.reduce((acc, site) => ({ ...acc, [site.uuid]: 0 }), {});
    }

    const reportIds = approvedReports.map(r => r.id);
    const reportBySiteId = groupBy(approvedReports, "siteId");

    const treesPlanted = await TreeSpecies.findAll({
      where: {
        speciesableId: { [Op.in]: reportIds },
        speciesableType: SiteReport.LARAVEL_TYPE,
        collection: "tree-planted",
        hidden: false
      },
      attributes: ["speciesableId", "amount"]
    });

    const result: Record<string, number> = {};

    for (const site of sites) {
      const siteId = site.id;
      const siteReports = reportBySiteId[siteId] ?? [];
      const siteReportIds = siteReports.map(r => r.id);
      const treesForSite = treesPlanted.filter(t => siteReportIds.includes(t.speciesableId));
      result[site.uuid] = sumBy(treesForSite, "amount") ?? 0;
    }

    return result;
  }

  private async getPlantingStatus(sites: Site[]): Promise<Record<string, PlantingStatus>> {
    if (sites.length === 0) return {};

    const siteIds = sites.map(site => site.id);
    const approvedReports = await SiteReport.approved()
      .sites(siteIds)
      .findAll({
        attributes: ["id", "siteId", "plantingStatus", "dueAt"],
        order: [["dueAt", "DESC"]]
      });

    if (approvedReports.length === 0) {
      return sites.reduce((acc, site) => ({ ...acc, [site.uuid]: undefined }), {});
    }

    const result: Record<string, PlantingStatus> = {};

    for (const site of sites) {
      const siteId = site.id;
      const siteReport = approvedReports.find(report => report.siteId === siteId);
      result[site.uuid] = siteReport?.plantingStatus as PlantingStatus;
    }

    return result;
  }

  async getFullDto(site: Site) {
    const siteId = site.id;

    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery([siteId]);
    const seedsPlantedCount = (await Seeding.visible().siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;
    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;

    const treesPlantedPolygonsCount = (await SitePolygon.approved().active().sites([site.uuid]).sum("numTrees")) ?? 0;
    const hectaresRestoredPolygonsCount =
      (await SitePolygon.approved().active().sites([site.uuid]).sum("calcArea")) ?? 0;

    const approvedSiteReports = await SiteReport.approved()
      .sites([siteId])
      .findAll({ attributes: ["id", "siteId", "numTreesRegenerating"] });

    const regeneratedTreesCount = sumBy(approvedSiteReports, "numTreesRegenerating");

    const hectaresData = await this.getHectaresRestoredSum([site.uuid]);
    const totalHectaresRestoredSum = hectaresData[site.uuid] ?? 0;
    const lastReport = await this.getLastReport(site.id);

    const dto = new SiteFullDto(site, {
      ...(await this.getFeedback(site)),

      totalHectaresRestoredSum,
      workdayCount: await this.getWorkdayCount(siteId),
      combinedWorkdayCount:
        (await this.getWorkdayCount(siteId, true)) + (await this.getSelfReportedWorkdayCount(siteId, true)),
      totalSiteReports: await this.getTotalSiteReports(siteId),
      seedsPlantedCount,
      overdueSiteReportsTotal: await this.getTotalOverdueReports(siteId),
      selfReportedWorkdayCount: await this.getSelfReportedWorkdayCount(siteId, true),
      regeneratedTreesCount,
      treesPlantedCount,
      plantingStatus: lastReport?.plantingStatus as PlantingStatus,
      treesPlantedPolygonsCount,
      hectaresRestoredPolygonsCount,
      ...(this.entitiesService.mapMediaCollection(
        await Media.for(site).findAll(),
        Site.MEDIA,
        "sites",
        site.uuid
      ) as SiteMedia)
    });

    await this.entitiesService.removeHiddenValues(site, dto);

    return { id: site.uuid, dto };
  }

  async getLightDto(site: Site) {
    const [hectaresData, treesPlantedData] = await Promise.all([
      this.getHectaresRestoredSum([site.uuid]),
      this.getTreesPlantedCount([site])
    ]);

    const totalHectaresRestoredSum = hectaresData[site.uuid] ?? 0;
    const treesPlantedCount = treesPlantedData[site.uuid] ?? 0;
    const lastReport = await this.getLastReport(site.id);

    return {
      id: site.uuid,
      dto: new SiteLightDto(site, {
        treesPlantedCount,
        totalHectaresRestoredSum,
        plantingStatus: lastReport?.plantingStatus as PlantingStatus
      })
    };
  }

  async getLightDtos(sites: Site[]): Promise<{ id: string; dto: SiteLightDto }[]> {
    if (sites.length === 0) return [];

    const siteUuids = sites.map(site => site.uuid);

    const [hectaresData, treesPlantedData, plantingStatus] = await Promise.all([
      this.getHectaresRestoredSum(siteUuids),
      this.getTreesPlantedCount(sites),
      this.getPlantingStatus(sites)
    ]);

    return sites.map(site => ({
      id: site.uuid,
      dto: new SiteLightDto(site, {
        treesPlantedCount: treesPlantedData[site.uuid] ?? 0,
        totalHectaresRestoredSum: hectaresData[site.uuid] ?? 0,
        plantingStatus: (plantingStatus[site.uuid] as PlantingStatus) ?? null
      })
    }));
  }

  protected async getWorkdayCount(siteId: number, useDemographicsCutoff = false) {
    const dueAfter = useDemographicsCutoff ? Demographic.DEMOGRAPHIC_COUNT_CUTOFF : undefined;

    const siteReportIds = SiteReport.approvedIdsSubquery([siteId], { dueAfter });
    const siteReportWorkdays = Demographic.idsSubquery(
      siteReportIds,
      SiteReport.LARAVEL_TYPE,
      Demographic.WORKDAYS_TYPE
    );

    return (
      (await DemographicEntry.gender().sum("amount", {
        where: {
          demographicId: { [Op.in]: siteReportWorkdays }
        }
      })) ?? 0
    );
  }

  protected async getSelfReportedWorkdayCount(siteId: number, useDemographicsCutoff = false) {
    let SR = SiteReport.approved().sites([siteId]);
    if (useDemographicsCutoff) {
      SR = SR.dueBefore(Demographic.DEMOGRAPHIC_COUNT_CUTOFF);
    }

    const aggregates = [
      { func: "SUM", attr: "workdaysPaid" },
      { func: "SUM", attr: "workdaysVolunteer" }
    ];
    const site = await aggregateColumns(SR, aggregates as Aggregate<SiteReport>[]);
    return (site.workdaysPaid ?? 0) + (site.workdaysVolunteer ?? 0);
  }

  protected async getTotalSiteReports(siteId: number) {
    return await SiteReport.sites([siteId]).count();
  }

  protected async getTotalOverdueReports(siteId: number) {
    const countOpts = { where: { dueAt: { [Op.lt]: new Date() } } };
    return await SiteReport.incomplete().sites([siteId]).count(countOpts);
  }

  protected async getLastReport(siteId: number) {
    return await SiteReport.approved()
      .sites([siteId])
      .lastReport()
      .findOne({ attributes: ["plantingStatus"] });
  }

  async delete(site: Site) {
    const permissions = await this.entitiesService.getPermissions();
    const managesOwn = permissions.includes("manage-own") && !permissions.includes(`framework-${site.frameworkKey}`);
    if (managesOwn) {
      const reportCount = await SiteReport.count({ where: { siteId: site.id } });
      if (reportCount > 0) {
        throw new NotAcceptableException("You can only delete sites that do not have reports");
      }
    }

    await super.delete(site);
  }

  async create({ parentUuid }: EntityCreateAttributes) {
    const project = await Project.findOne({ where: { uuid: parentUuid }, attributes: ["frameworkKey", "id"] });
    if (project == null) {
      throw new BadRequestException(`Project with uuid ${parentUuid} not found`);
    }

    const site = await this.authorizedCreation(Site, {
      projectId: project.id,
      frameworkKey: project.frameworkKey
    });

    const task = await Task.forProject(project.id).dueAtDesc().findOne();
    if (task != null) {
      // If we have a task due in the future, create a report
      let createReport = DateTime.now() <= DateTime.fromJSDate(task.dueAt);

      // Also, if we're more than 4 weeks before the next task will be generated, create a backdated
      // report for the previous period.
      if (!createReport) {
        const nextTask =
          project.frameworkKey == null ? undefined : await ScheduledJob.taskDue(project.frameworkKey).findOne();
        createReport =
          nextTask != null && DateTime.fromISO(nextTask.taskDefinition["dueAt"]) > DateTime.now().plus({ weeks: 4 });
      }

      if (createReport) {
        await SiteReport.create({
          taskId: task.id,
          frameworkKey: project.frameworkKey,
          siteId: site.id,
          dueAt: task.dueAt,
          createdBy: this.entitiesService.userId
        });
      }
    }

    // Load the full site with necessary associations.
    return (await this.findOne(site.uuid)) as Site;
  }
}
