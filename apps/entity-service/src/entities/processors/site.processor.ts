import { Aggregate, aggregateColumns, EntityProcessor } from "./entity-processor";
import {
  Demographic,
  DemographicEntry,
  Media,
  Project,
  ProjectUser,
  Role,
  Seeding,
  Site,
  SitePolygon,
  SiteReport,
  TreeSpecies,
  User
} from "@terramatch-microservices/database/entities";
import { AdditionalSiteFullProps, SiteFullDto, SiteLightDto, SiteMedia } from "../dto/site.dto";
import { BadRequestException, NotAcceptableException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { Includeable, Op } from "sequelize";
import { sumBy } from "lodash";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { Action } from "@terramatch-microservices/database/entities/action.entity";

export class SiteProcessor extends EntityProcessor<Site, SiteLightDto, SiteFullDto> {
  readonly LIGHT_DTO = SiteLightDto;
  readonly FULL_DTO = SiteFullDto;

  async findOne(uuid: string) {
    return await Site.findOne({
      where: { uuid },
      include: [
        { association: "framework" },
        {
          association: "project",
          attributes: ["uuid", "name", "country"],
          include: [{ association: "organisation", attributes: ["name"] }]
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

    if (query.sort != null) {
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

    const associationFieldMap = {
      organisationUuid: "$project.organisation.uuid$",
      country: "$project.country$",
      projectUuid: "$project.uuid$"
    };

    for (const term of [
      "status",
      "updateRequestStatus",
      "frameworkKey",
      "projectUuid",
      "organisationUuid",
      "country"
    ]) {
      const field = associationFieldMap[term] ?? term;
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

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async getFullDto(site: Site) {
    const siteId = site.id;

    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery([siteId]);
    const seedsPlantedCount = (await Seeding.visible().siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;
    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;

    const approvedSiteReports = await SiteReport.approved()
      .sites([siteId])
      .findAll({ attributes: ["id", "siteId", "numTreesRegenerating"] });

    const regeneratedTreesCount = sumBy(approvedSiteReports, "numTreesRegenerating");

    const props: AdditionalSiteFullProps = {
      totalHectaresRestoredSum: await SitePolygon.approved().sites([site.uuid]).sum("calcArea"),
      workdayCount: await this.getWorkdayCount(siteId),
      combinedWorkdayCount:
        (await this.getWorkdayCount(siteId, true)) + (await this.getSelfReportedWorkdayCount(siteId, true)),
      totalSiteReports: await this.getTotalSiteReports(siteId),
      seedsPlantedCount,
      overdueSiteReportsTotal: await this.getTotalOverdueReports(siteId),
      selfReportedWorkdayCount: await this.getSelfReportedWorkdayCount(siteId, true),
      regeneratedTreesCount,
      treesPlantedCount,

      ...(this.entitiesService.mapMediaCollection(await Media.site(siteId).findAll(), Site.MEDIA) as SiteMedia)
    };

    return { id: site.uuid, dto: new SiteFullDto(site, props) };
  }

  async getLightDto(site: Site) {
    const siteId = site.id;
    const approvedSiteReportsQuery = SiteReport.approvedIdsSubquery([siteId]);
    const treesPlantedCount =
      (await TreeSpecies.visible().collection("tree-planted").siteReports(approvedSiteReportsQuery).sum("amount")) ?? 0;

    return { id: site.uuid, dto: new SiteLightDto(site, { treesPlantedCount }) };
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
    return site.workdaysPaid + site.workdaysVolunteer;
  }

  protected async getTotalSiteReports(siteId: number) {
    return await SiteReport.sites([siteId]).count();
  }

  protected async getTotalOverdueReports(siteId: number) {
    const countOpts = { where: { dueAt: { [Op.lt]: new Date() } } };
    return await SiteReport.incomplete().sites([siteId]).count(countOpts);
  }

  async delete(site: Site, userId: number) {
    const user = await User.findOne({ where: { id: userId }, include: [Role] });
    const isAdmin = user?.roles?.some(r => r.name.startsWith("admin"));
    const reports = await SiteReport.count({ where: { siteId: site.id } });

    if (!isAdmin && reports > 0) {
      throw new NotAcceptableException("You can only delete sites that do not have reports");
    }

    await Action.targetable(Site.LARAVEL_TYPE, site.id).destroy();
    await site.destroy();
  }
}
