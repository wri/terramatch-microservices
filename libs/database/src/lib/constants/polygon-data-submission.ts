/**
 * DQA polygon data submission tracking on v2_projects (TM-3300).
 */
export const POLYGON_DATA_SUBMISSION_DEFAULT = "no-polygons-submitted";

export const POLYGON_DATA_SUBMISSION_VALUES = [
  POLYGON_DATA_SUBMISSION_DEFAULT,
  "not-applicable",
  "polygons-partially-submitted",
  "all-polygons-received"
] as const;

export type PolygonDataSubmission = (typeof POLYGON_DATA_SUBMISSION_VALUES)[number];
