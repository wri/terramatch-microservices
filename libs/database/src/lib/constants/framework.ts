export const FRAMEWORK_KEYS = [
  "terrafund",
  "terrafund-landscapes",
  "ppc",
  "enterprises",
  "hbf",
  "epa-ghana-pilot"
] as const;
export type FrameworkKey = (typeof FRAMEWORK_KEYS)[number];
