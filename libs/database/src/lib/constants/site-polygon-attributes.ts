export const SITE_POLYGON_PRACTICES = ["tree-planting", "direct-seeding", "assisted-natural-regeneration"] as const;

export type SitePolygonPractice = (typeof SITE_POLYGON_PRACTICES)[number];

export const SITE_POLYGON_TARGET_SYSTEMS = [
  "agroforest",
  "agricultural-land",
  "grassland",
  "open-natural-ecosystem",
  "natural-forest",
  "mangrove",
  "peatland",
  "riparian-area-or-wetland",
  "silvopasture",
  "woodlot-or-plantation",
  "urban-forest"
] as const;

export type SitePolygonTargetSystem = (typeof SITE_POLYGON_TARGET_SYSTEMS)[number];

export const SITE_POLYGON_DISTRIBUTIONS = ["single-line", "partial", "full"] as const;

export type SitePolygonDistribution = (typeof SITE_POLYGON_DISTRIBUTIONS)[number];

export const SITE_POLYGON_SOURCES = ["terramatch", "greenhouse", "research"] as const;

export type SitePolygonSource = (typeof SITE_POLYGON_SOURCES)[number];

export const SITE_POLYGON_SUBMISSION_CYCLES = ["1", "2", "3", "4", "5"] as const;

export type SitePolygonSubmissionCycle = (typeof SITE_POLYGON_SUBMISSION_CYCLES)[number];
