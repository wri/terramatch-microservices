export const TERRAFUND = "terrafund" as const;
export const LANDSCAPES = "terrafund-landscapes" as const;
export const PPC = "ppc" as const;
export const ENTERPRISES = "enterprises" as const;
export const HBF = "hbf" as const;
export const EPA = "epa-ghana-pilot" as const;
export const FUNDO_FLORA = "fundo-flora" as const;
export const TERRAFUND_3 = "terrafund-3" as const;
export const FUNDO_FLORA_1 = "fundo-flora-1" as const;

export const FRAMEWORK_KEYS_TF = [TERRAFUND, LANDSCAPES, ENTERPRISES, EPA, TERRAFUND_3] as const;
export type FrameworkKeyTF = (typeof FRAMEWORK_KEYS_TF)[number];

export const FRAMEWORK_KEYS = [...FRAMEWORK_KEYS_TF, PPC, HBF, FUNDO_FLORA, FUNDO_FLORA_1] as const;
export type FrameworkKey = (typeof FRAMEWORK_KEYS)[number];
