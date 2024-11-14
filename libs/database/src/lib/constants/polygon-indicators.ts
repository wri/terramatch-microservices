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
