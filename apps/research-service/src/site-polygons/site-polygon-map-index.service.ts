import { Injectable } from "@nestjs/common";
import { getStableRequestQuery } from "@terramatch-microservices/common/util";
import { SitePolygonMapIndexQueryDto } from "./dto/site-polygon-map-index-query.dto";
import { SitePolygonMapIndexDto, SitePolygonMapEntryDto } from "./dto/site-polygon-map-index.dto";
import { SitePolygonMapIndexQueryBuilder } from "./site-polygon-map-index-query.builder";
import { applySitePolygonScopeFilters } from "./site-polygon-scope-filters";

@Injectable()
export class SitePolygonMapIndexService {
  async getMapIndex(query: SitePolygonMapIndexQueryDto): Promise<SitePolygonMapIndexDto> {
    const builder = new SitePolygonMapIndexQueryBuilder();
    await applySitePolygonScopeFilters(builder, query);
    const sitePolygons = await builder.execute();

    return new SitePolygonMapIndexDto(
      sitePolygons.map(({ uuid, polygonUuid, status }): SitePolygonMapEntryDto => ({ uuid, polygonUuid, status }))
    );
  }

  getResourceId(query: SitePolygonMapIndexQueryDto): string {
    return getStableRequestQuery(query);
  }
}
