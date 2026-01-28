import { BadRequestException, Injectable } from "@nestjs/common";
import { Project, ProjectReport, SiteReport, Tracking } from "@terramatch-microservices/database/entities";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { TrackingsQueryDto } from "./dto/trackings-query.dto";
import { Op } from "sequelize";
import { LaravelModelCtor, laravelType } from "@terramatch-microservices/database/types/util";

type TrackingsFilter = {
  uuidKey: string;
  model: LaravelModelCtor;
};

const TRACKINGS_FILTERS: TrackingsFilter[] = [
  {
    uuidKey: "projectUuid",
    model: Project
  },
  {
    uuidKey: "projectReportUuid",
    model: ProjectReport
  },
  {
    uuidKey: "siteReportUuid",
    model: SiteReport
  }
] as const;

const VALID_FILTER_KEYS = TRACKINGS_FILTERS.map(({ uuidKey }) => uuidKey);

@Injectable()
export class TrackingsService {
  async getTrackings(query: TrackingsQueryDto) {
    const builder = PaginatedQueryBuilder.forNumberPage(Tracking, query);

    Object.keys(query).forEach(key => {
      if (key === "page" || key === "sort") return;
      if (!VALID_FILTER_KEYS.includes(key)) {
        throw new BadRequestException(`Invalid filter key: ${key}`);
      }
    });

    for (const { uuidKey, model } of TRACKINGS_FILTERS) {
      const uuids = query[uuidKey];
      if (uuids != null && uuids.length > 0) {
        const recordIds = (
          await model.findAll({
            attributes: ["id"],
            where: { uuid: { [Op.in]: uuids } }
          })
        ).map(({ id }) => id as number);

        if (recordIds.length > 0) {
          builder.where({
            id: { [Op.in]: Tracking.idsSubquery(recordIds, laravelType(model)) }
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
