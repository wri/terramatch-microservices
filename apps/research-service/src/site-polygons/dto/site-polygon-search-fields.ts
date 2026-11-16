// Kept apart from the query DTOs, which import entities, so exports can use it without a module cycle.
export const SITE_POLYGON_SEARCH_FIELDS = ["siteName", "polyName", "polygonUuid"] as const;
export type SitePolygonSearchField = (typeof SITE_POLYGON_SEARCH_FIELDS)[number];
