import { BadRequestException, Injectable } from "@nestjs/common";
import { Demographic, Project, ProjectReport, SiteReport } from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { DemographicQueryDto } from "./dto/demographic-query.dto";
import { Model, ModelStatic, Op } from "sequelize";

type DemographicFilter<T extends Model = Model> = {
  uuidKey: string;
  model: ModelStatic<T>;
  laravelType: string;
};

const DEMOGRAPHIC_FILTERS: DemographicFilter[] = [
  {
    uuidKey: "projectUuid",
    model: Project,
    laravelType: Project.LARAVEL_TYPE
  },
  {
    uuidKey: "projectReportUuid",
    model: ProjectReport,
    laravelType: ProjectReport.LARAVEL_TYPE
  },
  {
    uuidKey: "siteReportUuid",
    model: SiteReport,
    laravelType: SiteReport.LARAVEL_TYPE
  }
] as const;

const VALID_FILTER_KEYS = DEMOGRAPHIC_FILTERS.map(({ uuidKey }) => uuidKey);

@Injectable()
export class DemographicService {
  async getDemographics(query: DemographicQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Demographic, query);

    Object.keys(query).forEach(key => {
      if (key === "page" || key === "sort") return;
      if (!VALID_FILTER_KEYS.includes(key)) {
        throw new BadRequestException(`Invalid filter key: ${key}`);
      }
    });

    for (const { uuidKey, model, laravelType } of DEMOGRAPHIC_FILTERS) {
      const uuids = query[uuidKey];
      if (uuids != null && uuids.length > 0) {
        const records = (await model.findAll({
          attributes: ["id"],
          where: { uuid: { [Op.in]: uuids } }
        })) as unknown as { id: number }[];

        if (records.length > 0) {
          const demographicIds = Demographic.idsSubquery(
            records.map(record => record.id),
            laravelType
          );
          builder.where({
            id: { [Op.in]: demographicIds }
          });
        }
      }
    }

    if (query.sort?.field != null) {
      if (["id", "type"].includes(query.sort.field)) {
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
