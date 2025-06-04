import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Demographic, ProjectPitch, ProjectReport } from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { DemographicQueryDto } from "./dto/demographic-query.dto";

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
    if (query.projectReportUuid != null && query.projectReportUuid.length > 0) {
      const projectReports = await ProjectReport.findAll({
        where: { uuid: query.projectReportUuid }
      });
      if (projectReports.length === 0) {
        throw new NotFoundException("No project reports found for the provided UUIDs");
      }
      builder.where({
        projectPitchId: projectReports.map(pitch => pitch.id)
      });
    }
    return {
      data: await builder.execute(),
      paginationTotal: await builder.paginationTotal(),
      pageNumber: query.page?.number ?? 1
    };
  }
}
