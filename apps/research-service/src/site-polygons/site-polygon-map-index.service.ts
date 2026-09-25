import { Injectable } from "@nestjs/common";
import { getStableRequestQuery } from "@terramatch-microservices/common/util";
import {
  SITE_POLYGON_PRACTICES,
  SITE_POLYGON_TARGET_SYSTEMS,
  SitePolygonPractice,
  SitePolygonTargetSystem
} from "@terramatch-microservices/database/constants";
import { SitePolygonMapIndexQueryDto } from "./dto/site-polygon-map-index-query.dto";
import { SitePolygonMapIndexDto, SitePolygonMapEntryDto } from "./dto/site-polygon-map-index.dto";
import { SitePolygonMapIndexQueryBuilder } from "./site-polygon-map-index-query.builder";
import { applySitePolygonScopeFilters } from "./site-polygon-scope-filters";

const isSitePolygonPractice = (value: string): value is SitePolygonPractice =>
  (SITE_POLYGON_PRACTICES as readonly string[]).includes(value);

const isSitePolygonTargetSystem = (value: string): value is SitePolygonTargetSystem =>
  (SITE_POLYGON_TARGET_SYSTEMS as readonly string[]).includes(value);

const toMapIndexPractices = (practice: string[] | null | undefined): SitePolygonPractice[] | null => {
  if (practice == null) {
    return null;
  }
  const practices = practice.filter(isSitePolygonPractice);
  return practices.length > 0 ? practices : null;
};

const toMapIndexTargetSys = (targetSys: string | null | undefined): SitePolygonTargetSystem | null => {
  if (targetSys == null || targetSys === "") {
    return null;
  }
  return isSitePolygonTargetSystem(targetSys) ? targetSys : null;
};

@Injectable()
export class SitePolygonMapIndexService {
  async getMapIndex(query: SitePolygonMapIndexQueryDto): Promise<SitePolygonMapIndexDto> {
    const builder = new SitePolygonMapIndexQueryBuilder();
    await applySitePolygonScopeFilters(builder, query);
    const sitePolygons = await builder.execute();

    return new SitePolygonMapIndexDto(
      sitePolygons.map(
        ({
          uuid,
          polygonUuid,
          siteUuid,
          status,
          polyName,
          numTrees,
          calcArea,
          validationStatus,
          practice,
          targetSys,
          disturbance
        }): SitePolygonMapEntryDto => ({
          uuid,
          polygonUuid,
          siteId: siteUuid ?? null,
          status,
          name: polyName ?? null,
          numTrees: numTrees ?? null,
          calcArea: calcArea ?? null,
          validationStatus: validationStatus ?? null,
          practice: toMapIndexPractices(practice),
          targetSys: toMapIndexTargetSys(targetSys),
          disturbanceReportUuid: disturbance?.getDisturbanceReportUuid() ?? null
        })
      )
    );
  }

  getResourceId(query: SitePolygonMapIndexQueryDto): string {
    return getStableRequestQuery(query);
  }
}
