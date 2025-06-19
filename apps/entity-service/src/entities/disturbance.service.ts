import { BadRequestException, Injectable } from "@nestjs/common";
import { Disturbance, SiteReport } from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { Model, ModelStatic, Op } from "sequelize";
import { DisturbanceQueryDto } from "./dto/disturbance-query.dto";

type DisturbanceFilter<T extends Model = Model> = {
  uuidKey: string;
  model: ModelStatic<T>;
  laravelType: string;
};

const DISTURBANCES_FILTERS: DisturbanceFilter[] = [
  {
    uuidKey: "siteReportUuid",
    model: SiteReport,
    laravelType: SiteReport.LARAVEL_TYPE
  }
] as const;

const VALID_FILTER_KEYS = DISTURBANCES_FILTERS.map(({ uuidKey }) => uuidKey);

@Injectable()
export class DisturbanceService {
  async getDisturbances(query: DisturbanceQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Disturbance, query);

    Object.keys(query).forEach(key => {
      if (key === "page" || key === "sort") return;
      if (!VALID_FILTER_KEYS.includes(key)) {
        throw new BadRequestException(`Invalid filter key: ${key}`);
      }
    });

    for (const { uuidKey, model, laravelType } of DISTURBANCES_FILTERS) {
      const uuids = query[uuidKey];
      if (uuids != null && uuids.length > 0) {
        const records = (await model.findAll({
          attributes: ["id"],
          where: { uuid: { [Op.in]: uuids } }
        })) as unknown as { id: number }[];

        if (records.length > 0) {
          const disturbanceIds = Disturbance.idsSubquery(
            records.map(record => record.id),
            laravelType
          );
          builder.where({
            id: { [Op.in]: disturbanceIds }
          });
        } else {
          return {
            data: [],
            paginationTotal: 0,
            pageNumber: query.page?.number ?? 1
          };
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
