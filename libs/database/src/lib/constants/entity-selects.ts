export const SITING_STRATEGIES = ["concentred", "distributed", "hybrid", "not-applicable"] as const;
export type SitingStrategy = (typeof SITING_STRATEGIES)[number];
