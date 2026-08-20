// Matches the indicators defined on https://gfw.atlassian.net/wiki/spaces/TerraMatch/pages/1469448210/Indicator+Data+Model
export const INDICATORS = {
  1: "treeCover",
  2: "treeCoverLoss",
  3: "treeCoverLossFires",
  4: "restorationByEcoRegion",
  5: "restorationByStrategy",
  6: "restorationByLandUse",
  7: "treeCount",
  8: "earlyTreeVerification",
  9: "fieldMonitoring",
  10: "msuCarbon"
} as const;
export const INDICATOR_SLUGS = Object.values(INDICATORS);
export type IndicatorSlug = (typeof INDICATOR_SLUGS)[number];

export const INDICATOR_DISPLAY_NAMES: Record<IndicatorSlug, string> = {
  treeCover: "Tree Cover",
  treeCoverLoss: "Tree Cover Loss",
  treeCoverLossFires: "Tree Cover Loss from Fire",
  restorationByEcoRegion: "Hectares Under Restoration By WWF EcoRegion",
  restorationByStrategy: "Hectares Under Restoration By Strategy",
  restorationByLandUse: "Hectares Under Restoration By Target Land Use System",
  treeCount: "Tree Count",
  earlyTreeVerification: "Early Tree Verification",
  fieldMonitoring: "Field Monitoring",
  msuCarbon: "MSU Carbon"
};

export const getIndicatorDisplayName = (slug: IndicatorSlug): string =>
  INDICATOR_DISPLAY_NAMES[slug] ?? "Indicator Calculation";

/** Empty API responses are valid successful results (e.g. confirmed zero tree cover loss). */
export const INDICATORS_WHERE_EMPTY_RESPONSE_IS_SUCCESS: readonly IndicatorSlug[] = [
  "treeCoverLoss",
  "treeCoverLossFires"
];

/** Summary popups show a separate "No Data Returned" line for these indicators. */
export const INDICATORS_WITH_NO_DATA_SUMMARY_LINE: readonly IndicatorSlug[] = [
  "restorationByEcoRegion",
  "restorationByStrategy",
  "restorationByLandUse"
];
