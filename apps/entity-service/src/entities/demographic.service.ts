import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Demographic, ProjectPitch } from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { DemographicQueryDto } from "./dto/demographic-query.dto";

@Injectable()
export class DemographicService {
  async getDemographics(query: DemographicQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Demographic, query);

    if (query.sort?.field != null) {
      if (
        ["id", "organisationId", "projectName", "projectCountry", "restorationInterventionTypes", "createdAt"].includes(
          query.sort.field
        )
      ) {
        builder.order([query.sort.field, query.sort.direction ?? "ASC"]);
      } else {
        throw new BadRequestException(`Invalid sort field: ${query.sort.field}`);
      }
    }
    return {
      data: await builder.execute(),
      paginationTotal: await builder.paginationTotal(),
      pageNumber: query.page?.number ?? 1
    };
  }
}
