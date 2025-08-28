export const VALID_LOCALES = ["en-US", "es-MX", "fr-FR", "pt-BR"] as const;
export type ValidLocale = (typeof VALID_LOCALES)[number];
