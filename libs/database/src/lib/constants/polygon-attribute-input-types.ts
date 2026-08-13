export const POLYGON_ATTRIBUTE_INPUT_TYPES = ["single_select", "multi_select"] as const;

export type PolygonAttributeInputType = (typeof POLYGON_ATTRIBUTE_INPUT_TYPES)[number];
