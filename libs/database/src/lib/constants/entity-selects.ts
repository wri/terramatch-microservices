export const SITING_STRATEGIES = ["concentrated", "distributed", "hybrid", "not-applicable"] as const;
export type SitingStrategy = (typeof SITING_STRATEGIES)[number];
