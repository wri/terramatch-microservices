export const FRAMEWORK_NAMES = {
  terrafund: "TerraFund Top 100",
  "terrafund-landscapes": "TerraFund Landscapes",
  ppc: "Priceless Planet Coalition (PPC)",
  enterprises: "TerraFund Enterprises",
  hbf: "Harit Bharat Fund",
  "epa-ghana-pilot": "EPA-Ghana Pilot"
} as const;

export const FRAMEWORK_KEYS = Object.keys(FRAMEWORK_NAMES);
export type FrameworkKey = keyof typeof FRAMEWORK_NAMES;
