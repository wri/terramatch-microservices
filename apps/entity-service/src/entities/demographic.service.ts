import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  Demographic,
  Project,
  ProjectPitch,
  ProjectReport,
  ProjectUser,
  SiteReport
} from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { DemographicQueryDto } from "./dto/demographic-query.dto";
import { Op } from "sequelize";

@Injectable()
export class DemographicService {
  async getDemographics(query: DemographicQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Demographic, query);

    if (query.sort?.field != null) {
      if (["id", "type"].includes(query.sort.field)) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }
    if (query.projectUuid != null && query.projectUuid.length > 0) {
      const project = await Project.findAll({
        attributes: ["id"],
        where: { uuid: { [Op.in]: query.projectReportUuid } }
      });

      if (project.length > 0) {
        const projectDemographics = Demographic.idsSubquery(
          project.map(report => report.id),
          Project.LARAVEL_TYPE
        );

        builder.where({
          id: { [Op.in]: projectDemographics }
        });
      }
    }
    if (query.projectReportUuid != null && query.projectReportUuid.length > 0) {
      const projectReport = await ProjectReport.findAll({
        attributes: ["id"],
        where: { uuid: { [Op.in]: query.projectReportUuid } }
      });

      if (projectReport.length > 0) {
        const projectReportDemographics = Demographic.idsSubquery(
          projectReport.map(report => report.id),
          ProjectReport.LARAVEL_TYPE
        );

        builder.where({
          id: { [Op.in]: projectReportDemographics }
        });
      }
    }
    if (query.siteReportUuid != null && query.siteReportUuid.length > 0) {
      const siteReports = await SiteReport.findAll({
        attributes: ["id"],
        where: { uuid: { [Op.in]: query.siteReportUuid } }
      });

      if (siteReports.length > 0) {
        const siteReportDemographic = Demographic.idsSubquery(
          siteReports.map(report => report.id),
          SiteReport.LARAVEL_TYPE
        );

        builder.where({
          id: { [Op.in]: siteReportDemographic }
        });
      }
    }
    return {
      data: await builder.execute(),
      paginationTotal: await builder.paginationTotal(),
      pageNumber: query.page?.number ?? 1
    };
  }
}
