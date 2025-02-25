import { DocumentBuilder } from "@terramatch-microservices/common/util";
import { Aggregate, aggregateColumns, EntityProcessor, PaginatedResult } from "./entity-processor";
import {
  Demographic,
  DemographicEntry,
  Media,
  ProjectUser,
  Site,
  SitePolygon,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { AdditionalSiteFullProps, SiteFullDto, SiteLightDto, SiteMedia } from "../dto/site.dto";
import { EntityQueryDto } from "../dto/entity-query.dto";
import { BadRequestException } from "@nestjs/common";
import { FrameworkKey } from "@terramatch-microservices/database/constants/framework";
import { Op } from "sequelize";

export class SiteProcessor extends EntityProcessor<Site, SiteLightDto, SiteFullDto> {
  readonly LIGHT_DTO = SiteLightDto;
  readonly FULL_DTO = SiteFullDto;

  async findOne(uuid: string) {
    return await Site.findOne({
      where: { uuid },
      include: [
        { association: "framework" },
        { association: "project", attributes: ["name"], include: [{ association: "organisation" }] }
      ]
    });
  }

  async findMany(query: EntityQueryDto, userId?: number, permissions?: string[]): Promise<PaginatedResult<Site>> {
    const builder = await this.entitiesService.buildQuery(Site, query, [
      { association: "project", attributes: ["name"] },
      { association: "framework" }
    ]);

    if (query.sort != null) {
      if (["name"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else if (query.sort.field === "projectName") {
        builder.order(["project", "name", query.sort.direction ?? "ASC"]);
      } else if (query.sort.field !== "id") {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }

    const frameworkPermissions = permissions
      ?.filter(name => name.startsWith("framework-"))
      .map(name => name.substring("framework-".length) as FrameworkKey);
    if (frameworkPermissions?.length > 0) {
      builder.where({ frameworkKey: { [Op.in]: frameworkPermissions } });
    } else if (permissions?.includes("manage-own")) {
      builder.where({
        projectId: { [Op.in]: ProjectUser.userProjectsSubquery(userId) }
      });
    } else if (permissions?.includes("projects-manage")) {
      builder.where({
        projectId: { [Op.in]: ProjectUser.projectsManageSubquery(userId) }
      });
    }

    for (const term of ["name", "projectName"]) {
      if (query[term] != null) builder.where({ [term]: query[term] });
    }
    if (query.search != null) {
      builder.where({ name: { [Op.like]: `%${query.search}%` } });
    }

    return { models: await builder.execute(), paginationTotal: await builder.paginationTotal() };
  }

  async addFullDto(document: DocumentBuilder, site: Site): Promise<void> {
    const siteId = site.id;
    const approvedUuidsSiteSubquery = Site.approvedUuidsSiteSubquery(siteId);
    const props: AdditionalSiteFullProps = {
      totalHectaresRestoredSum:
        (await SitePolygon.active().approved().sites(approvedUuidsSiteSubquery).sum("calcArea")) ?? 0,
      workdayCount: (await this.getWorkdayCount(siteId)) ?? 0,
      combinedWorkdayCount:
        (await this.getWorkdayCount(siteId, true)) + (await this.getSelfReportedWorkdayCount(siteId, true)),
      siteReportsTotal: await this.getTotalSiteReports(siteId),

      ...(this.entitiesService.mapMediaCollection(await Media.site(siteId).findAll(), Site.MEDIA) as SiteMedia)
    };

    document.addData(site.uuid, new SiteFullDto(site, props));
  }

  async addLightDto(document: DocumentBuilder, site: Site) {
    document.addData(site.uuid, new SiteLightDto(site));
  }

  protected async getWorkdayCount(siteId: number, useDemographicsCutoff = false) {
    const dueAfter = useDemographicsCutoff ? Demographic.DEMOGRAPHIC_COUNT_CUTOFF : undefined;

    const siteIds = Site.approvedIdsSiteSubquery(siteId);
    const siteReportIds = SiteReport.approvedIdsSubquery(siteIds, { dueAfter });
    const siteReportWorkdays = Demographic.idsSubquery(
      siteReportIds,
      SiteReport.LARAVEL_TYPE,
      Demographic.WORKDAYS_TYPE
    );

    return (
      (await DemographicEntry.gender().sum("amount", {
        where: {
          demographicId: {
            [Op.or]: [{ [Op.in]: siteReportWorkdays }]
          }
        }
      })) ?? 0
    );
  }

  protected async getSelfReportedWorkdayCount(siteId: number, useDemographicsCutoff = false) {
    let SR = SiteReport.approved().sites(Site.approvedIdsSiteSubquery(siteId));
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
    return await SiteReport.sites(Site.approvedIdsSiteSubquery(siteId)).count();
  }
}
