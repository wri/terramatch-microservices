import { BadRequestException, Injectable } from "@nestjs/common";
import { SitePolygonMapIndexQueryDto } from "./dto/site-polygon-map-index-query.dto";
import { SitePolygonMapEntryDto, SitePolygonMapIndexDto } from "./dto/site-polygon-map-index.dto";
import { SitePolygonMapIndexQueryBuilder } from "./site-polygon-map-index-query.builder";

@Injectable()
export class SitePolygonMapIndexService {
  async getMapIndex(query: SitePolygonMapIndexQueryDto): Promise<SitePolygonMapIndexDto> {
    const { siteId, projectId, deletedOnly } = query;

    if ((siteId == null) === (projectId == null)) {
      throw new BadRequestException("Exactly one of siteId[] or projectId[] must be provided.");
    }
    if (deletedOnly === true && (siteId == null || siteId.length !== 1)) {
      throw new BadRequestException("deletedOnly requires exactly one siteId[] value.");
    }
    if (
      query.plantStartFrom != null &&
      query.plantStartTo != null &&
      query.plantStartFrom.getTime() > query.plantStartTo.getTime()
    ) {
      throw new BadRequestException("plantStartFrom must be on or before plantStartTo");
    }
    if (query.missingIndicator != null && query.presentIndicator != null) {
      throw new BadRequestException(
        "Only one of missingIndicator[] or presentIndicator[] may be used in a single request."
      );
    }

    const builder = new SitePolygonMapIndexQueryBuilder();

    if (deletedOnly === true) {
      builder.includeSoftDeleted().filterSoftDeletedOnly();
    }

    if (siteId != null) await builder.filterSiteUuids(siteId);
    else if (projectId != null) await builder.filterProjectUuids(projectId);

    builder.hasStatuses(query.polygonStatus).modifiedSince(query.lastModifiedDate);

    if (query.validationStatus != null) await builder.filterValidationStatus(query.validationStatus);
    if (query.polygonUuid != null) await builder.filterPolygonUuids(query.polygonUuid);

    if (query.missingIndicator != null && query.missingIndicator.length > 0) {
      builder.isMissingIndicators(query.missingIndicator);
    } else if (query.presentIndicator != null && query.presentIndicator.length > 0) {
      builder.hasPresentIndicators(query.presentIndicator);
    }

    builder
      .filterPlantStartRange(query.plantStartFrom, query.plantStartTo)
      .filterPractice(query.practice)
      .filterDistr(query.distr)
      .filterTargetSys(query.targetSys)
      .filterSubmissionCycle(query.submissionCycle)
      .filterSource(query.source)
      .filterHasOverlap(query.hasOverlap);

    if (query.search != null) await builder.addSearch(query.search, query.searchFields);

    const sitePolygons = await builder.execute();

    return new SitePolygonMapIndexDto(
      sitePolygons.map(({ uuid, polygonUuid, status }): SitePolygonMapEntryDto => ({ uuid, polygonUuid, status }))
    );
  }

  getResourceId({ siteId, projectId, deletedOnly }: SitePolygonMapIndexQueryDto): string {
    const scope =
      siteId != null ? `sites:${[...siteId].sort().join(",")}` : `projects:${[...(projectId ?? [])].sort().join(",")}`;
    return deletedOnly === true ? `deleted:${scope}` : scope;
  }
}
