const TERRAFUND = "terrafund" as const;
const LANDSCAPES = "terrafund-landscapes" as const;
const PPC = "ppc" as const;
const ENTERPRISES = "enterprises" as const;
const HBF = "hbf" as const;
const EPA = "epa-ghana-pilot" as const;
const FUNDO_FLORA = "fundo-flora" as const;

export const FRAMEWORK_KEYS_TF = [TERRAFUND, LANDSCAPES, ENTERPRISES, EPA] as const;
export type FrameworkKeyTF = (typeof FRAMEWORK_KEYS_TF)[number];

export const FRAMEWORK_KEYS = [...FRAMEWORK_KEYS_TF, PPC, HBF, FUNDO_FLORA] as const;
export type FrameworkKey = (typeof FRAMEWORK_KEYS)[number];
