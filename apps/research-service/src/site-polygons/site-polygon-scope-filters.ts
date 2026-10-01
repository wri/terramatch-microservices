import { BadRequestException } from "@nestjs/common";
import { SitePolygonMapIndexQueryDto } from "./dto/site-polygon-map-index-query.dto";
import { SitePolygonMapIndexQueryBuilder } from "./site-polygon-map-index-query.builder";

const nonEmpty = <T>(value: T[] | null | undefined): T[] | undefined =>
  value != null && value.length > 0 ? value : undefined;

export async function applySitePolygonScopeFilters(
  builder: SitePolygonMapIndexQueryBuilder,
  query: SitePolygonMapIndexQueryDto
): Promise<void> {
  const { siteId, projectId, deletedOnly } = query;

  if ((siteId == null) === (projectId == null)) {
    throw new BadRequestException("Exactly one of siteId[] or projectId[] must be provided.");
  }
  if (siteId != null && siteId.length === 0) {
    throw new BadRequestException("siteId[] must contain at least one UUID.");
  }
  if (projectId != null && projectId.length === 0) {
    throw new BadRequestException("projectId[] must contain at least one UUID.");
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

  if (deletedOnly === true) {
    builder.includeSoftDeleted().filterSoftDeletedOnly();
  }

  if (siteId != null) await builder.filterSiteUuids(siteId);
  else if (projectId != null) await builder.filterProjectUuids(projectId);

  builder.hasStatuses(nonEmpty(query.polygonStatus)).modifiedSince(query.lastModifiedDate);

  const validationStatus = nonEmpty(query.validationStatus);
  if (validationStatus != null) await builder.filterValidationStatus(validationStatus);

  const polygonUuid = nonEmpty(query.polygonUuid);
  if (polygonUuid != null) await builder.filterPolygonUuids(polygonUuid);

  const missingIndicator = nonEmpty(query.missingIndicator);
  const presentIndicator = nonEmpty(query.presentIndicator);
  if (missingIndicator != null) {
    builder.isMissingIndicators(missingIndicator);
  } else if (presentIndicator != null) {
    builder.hasPresentIndicators(presentIndicator);
  }

  builder
    .filterPlantStartRange(query.plantStartFrom, query.plantStartTo)
    .filterPractice(nonEmpty(query.practice))
    .filterDistr(nonEmpty(query.distr))
    .filterTargetSys(nonEmpty(query.targetSys))
    .filterSubmissionCycle(nonEmpty(query.submissionCycle))
    .filterSource(nonEmpty(query.source))
    .filterHasOverlap(query.hasOverlap)
    .filterHasDisturbance(query.hasDisturbance);

  if (query.search != null) await builder.addSearch(query.search, nonEmpty(query.searchFields));
}
