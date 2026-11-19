import { BadRequestException } from "@nestjs/common";
import { SitePolygonMapIndexQueryDto } from "./dto/site-polygon-map-index-query.dto";
import { SitePolygonColumnQueryBuilder } from "./site-polygon-column-query.builder";
import { SitePolygonMapIndexQueryBuilder } from "./site-polygon-map-index-query.builder";
import { hasProjectContextFilters } from "./project-context-filters";

const nonEmpty = <T>(value: T[] | null | undefined): T[] | undefined =>
  value != null && value.length > 0 ? value : undefined;

export type SitePolygonScopeOptions = {
  requireSiteOrProject: boolean;
};

/** The table filters shared by the polygon index endpoints and the polygon exports. */
export type SitePolygonFilterQuery = Partial<
  Pick<
    SitePolygonMapIndexQueryDto,
    | "polygonStatus"
    | "validationStatus"
    | "practice"
    | "targetSys"
    | "distr"
    | "submissionCycle"
    | "source"
    | "plantStartFrom"
    | "plantStartTo"
    | "hasOverlap"
    | "hasDisturbance"
    | "deletedOnly"
    | "search"
    | "searchFields"
  >
>;

export async function applySitePolygonScopeFilters(
  builder: SitePolygonMapIndexQueryBuilder,
  query: SitePolygonMapIndexQueryDto,
  { requireSiteOrProject }: SitePolygonScopeOptions
): Promise<void> {
  const { siteId, projectId, deletedOnly } = query;
  const hasSiteOrProject = siteId != null || projectId != null;
  const hasProjectContext = hasProjectContextFilters(query);

  if (requireSiteOrProject && !hasSiteOrProject) {
    throw new BadRequestException("At least one of siteId[] or projectId[] must be provided.");
  }
  if (!hasSiteOrProject && !hasProjectContext) {
    throw new BadRequestException(
      "At least one of siteId[], projectId[], frameworkKey[], country[], organisationUuid[] or plantingStatus must be provided."
    );
  }
  if (siteId != null && siteId.length === 0) {
    throw new BadRequestException("siteId[] must contain at least one UUID.");
  }
  if (projectId != null && projectId.length === 0) {
    throw new BadRequestException("projectId[] must contain at least one UUID.");
  }
  if (deletedOnly === true && !hasSiteOrProject) {
    throw new BadRequestException("deletedOnly requires at least one siteId[] or projectId[] value.");
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

  if (siteId != null) await builder.filterSiteUuids(siteId);
  if (projectId != null) await builder.filterProjectUuids(projectId);
  builder.filterProjectContext(query, !hasSiteOrProject);

  builder.modifiedSince(query.lastModifiedDate);

  const polygonUuid = nonEmpty(query.polygonUuid);
  if (polygonUuid != null) await builder.filterPolygonUuids(polygonUuid);

  const missingIndicator = nonEmpty(query.missingIndicator);
  const presentIndicator = nonEmpty(query.presentIndicator);
  if (missingIndicator != null) {
    builder.isMissingIndicators(missingIndicator);
  } else if (presentIndicator != null) {
    builder.hasPresentIndicators(presentIndicator);
  }

  await applySitePolygonFilters(builder, query);
}

/**
 * Applies the table filters (status, validation, practice, dates, search, etc.) to a polygon query. Scope
 * (site, project, polygon UUIDs) is applied by the caller, so exports can reuse this without the index's
 * requirement that a site or project is given.
 */
export async function applySitePolygonFilters(
  builder: SitePolygonColumnQueryBuilder,
  query: SitePolygonFilterQuery
): Promise<void> {
  if (query.deletedOnly === true) {
    builder.includeSoftDeleted().filterSoftDeletedOnly();
  }

  builder.hasStatuses(nonEmpty(query.polygonStatus));

  const validationStatus = nonEmpty(query.validationStatus);
  if (validationStatus != null) await builder.filterValidationStatus(validationStatus);

  builder
    .filterPlantStartRange(query.plantStartFrom, query.plantStartTo)
    .filterCalcAreaRange(query.calcAreaMin, query.calcAreaMax)
    .filterPractice(nonEmpty(query.practice))
    .filterDistr(nonEmpty(query.distr))
    .filterTargetSys(nonEmpty(query.targetSys))
    .filterSubmissionCycle(nonEmpty(query.submissionCycle))
    .filterSource(nonEmpty(query.source))
    .filterHasOverlap(query.hasOverlap)
    .filterHasDisturbance(query.hasDisturbance);

  if (query.search != null) await builder.addSearch(query.search, nonEmpty(query.searchFields));
}
