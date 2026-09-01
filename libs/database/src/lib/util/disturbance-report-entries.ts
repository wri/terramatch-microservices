import { isNotNull } from "../types/array";

export const POLYGON_AFFECTED_ENTRY_NAME = "polygon-affected";

type AffectedPolygon = { polyUuid?: string };

/**
 * Parses `disturbance_report_entries.value` for `name = 'polygon-affected'`.
 * Stored shape is a nested array of `{ polyUuid, polyName, siteUuid }` groups.
 */
export const parsePolygonAffectedUuids = (value: string | null | undefined): string[] => {
  if (value == null || value === "") return [];

  try {
    const polygons = JSON.parse(value) as AffectedPolygon[][] | null;
    if (!Array.isArray(polygons) || polygons.length === 0) return [];

    return polygons
      .flatMap(group => (Array.isArray(group) ? group : []))
      .map(polygon => polygon?.polyUuid)
      .filter(isNotNull);
  } catch {
    return [];
  }
};
