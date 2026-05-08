export const POLYGON_DATA_SUBMISSION_DEFAULT = "no-polygons-submitted";

export const POLYGON_DATA_SUBMISSION_VALUES = [
  POLYGON_DATA_SUBMISSION_DEFAULT,
  "not-applicable",
  "polygons-partially-submitted",
  "all-polygons-received"
] as const;

export const POLYGON_DATA_SUBMISSION_MAP = {
  [POLYGON_DATA_SUBMISSION_DEFAULT]: "No Polygons Submitted",
  "not-applicable": "Not Applicable",
  "polygons-partially-submitted": "Polygons Partially Submitted",
  "all-polygons-received": "All Polygons Received"
} as const;

export type PolygonDataSubmission = (typeof POLYGON_DATA_SUBMISSION_VALUES)[number];
