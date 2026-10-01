export const VERIFICATION_METHODS = ["field", "remote"] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];
