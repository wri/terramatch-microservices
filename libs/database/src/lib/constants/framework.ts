export const TERRAFUND_NON_PROFITS = "terrafund-non-profits" as const;
export const PPC = "ppc" as const;
export const ENTERPRISES = "enterprises" as const;
export const HBF = "hbf" as const;
export const EPA = "epa-ghana-pilot" as const;
export const FUNDO_FLORA_1 = "fundo-flora-1" as const;
export const WCB = "wcb" as const;
export const BARKA_FUND = "barka-fund" as const;

export const FRAMEWORK_KEYS_TF = [TERRAFUND_NON_PROFITS, ENTERPRISES, EPA] as const;
export type FrameworkKeyTF = (typeof FRAMEWORK_KEYS_TF)[number];

export const FINANCIAL_REPORT_FRAMEWORKS = [TERRAFUND_NON_PROFITS, ENTERPRISES] as const;
export type FinancialReportFramework = (typeof FINANCIAL_REPORT_FRAMEWORKS)[number];

export const FRAMEWORK_KEYS = [...FRAMEWORK_KEYS_TF, PPC, HBF, FUNDO_FLORA_1, WCB, BARKA_FUND] as const;
export type FrameworkKey = (typeof FRAMEWORK_KEYS)[number];

/** User-facing display names for each framework. */
export const FRAMEWORK_NAMES: Record<FrameworkKey, string> = {
  "barka-fund": "Barka Fund",
  enterprises: "TerraFund Enterprises",
  "epa-ghana-pilot": "EPA-Ghana Pilot",
  "fundo-flora-1": "Fundo Flora 1",
  hbf: "Harit Bharat Fund",
  ppc: "PPC",
  "terrafund-non-profits": "TerraFund Non-Profits",
  wcb: "Wildlife Conservation Bond"
};
